import { useCallback, useEffect, useRef, useState } from "react";
import { loadConfig, mergeConfig, saveConfig } from "../config/defaults";
import {
  DashboardConfig,
  DashboardState,
  EntityOption,
  HeatpumpCycleSegment,
  HeatpumpTempPoint,
  MonthlyStat,
  OverviewPeriod,
  PeriodBucket,
  WeeklyStat,
} from "../types/dashboard";
import { computeHomePower } from "../utils/energyMath";

interface HaStateObj {
  entity_id: string;
  state: string;
  attributes?: {
    friendly_name?: string;
    entity_picture?: string;
    unit_of_measurement?: string;
  };
}

interface RecorderStatPoint {
  start: string | number;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  state?: number | string | null;
  change?: number | null;
}

const INITIAL_STATE: DashboardState = {
  solar_power: 0,
  grid_power: 0,
  home_power: 0,
  battery_power: 0,
  battery_soc: null,
  battery_cycles: null,
  battery_discharge_today: null,
  solar_today: null,
  solar_forecast_today: null,
  solar_forecast_tomorrow: null,
  grid_import_today: null,
  grid_export_today: null,
  ev_range: null,
  ev_soc: null,
  ev_charge_power: null,
  water_meter: null,
  water_today: null,
  water_temp: null,
  hp_live_status: null,
  hp_live_flow: null,
  hp_live_return: null,
  hp_live_outside: null,
  hp_live_room: null,
  current_energy_price: null,
  camera_image_url: null,
  motion_detected: false,
  connected: false,
  lastUpdated: null,
  availableEntities: [],
  isFetchingEntities: false,
  entityError: null,
  device_states: {},
  history: { solar: [], consumption: [], battery: [], water: [] },
  statistics: { monthly: [], weekly: [] },
  periodBuckets: [],
  heatpump: {
    loading: false,
    error: null,
    lastAnalyzed: null,
    hoursWindow: 24,
    heatCycles: 0,
    avgHeatMinutes: 0,
    avgStandbyMinutes: 0,
    otShutdownCount: 0,
    compStartsDelta: null,
    compHoursDelta: null,
    backupHoursDelta: null,
    avgSpreadK: null,
    outsideAvg: null,
    outsideMin: null,
    outsideMax: null,
    roomAvg: null,
    sourceInAvg: null,
    sourceOutAvg: null,
    sourceSpreadK: null,
    tempSeries: [],
    recentCycles: [],
  },
};

function parseNumOrNull(val: string): number | null {
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function parseNumOrZero(val: string): number {
  const n = parseFloat(val);
  return Number.isNaN(n) ? 0 : n;
}

export function useHomeAssistant() {
  const [config, setConfig] = useState<DashboardConfig>(() => loadConfig());
  const [serverConfigLoaded, setServerConfigLoaded] = useState(false);
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);

  const wsRef = useRef<WebSocket | null>(null);
  const reqIdRef = useRef(1);
  const pendingRef = useRef<
    Record<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>
  >({});
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Load shared configuration from server on startup so any user/browser sees the dashboard
  useEffect(() => {
    let active = true;
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { config?: Partial<DashboardConfig> | null } | null) => {
        if (!active) return;
        if (data?.config) {
          const merged = mergeConfig(data.config);
          saveConfig(merged);
          setConfig(merged);
        }
        setServerConfigLoaded(true);
      })
      .catch(() => {
        if (active) setServerConfigLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateConfig = useCallback((next: Partial<DashboardConfig>) => {
    setConfig((prev) => {
      const merged = mergeConfig({ ...prev, ...next });
      saveConfig(merged);
      fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      }).catch((err) => console.error("Failed to save config to server:", err));
      return merged;
    });
  }, []);

  const sendWs = useCallback((payload: Record<string, unknown>): number | null => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const id = reqIdRef.current++;
      wsRef.current.send(JSON.stringify({ ...payload, id }));
      return id;
    }
    return null;
  }, []);

  const requestWs = useCallback(
    <T = unknown>(payload: Record<string, unknown>, timeoutMs = 10000): Promise<T> =>
      new Promise((resolve, reject) => {
        const id = sendWs(payload);
        if (id === null) {
          reject(new Error("WebSocket nicht verbunden"));
          return;
        }
        const timer = setTimeout(() => {
          if (pendingRef.current[id]) {
            delete pendingRef.current[id];
            reject(new Error(`WebSocket-Anfrage ${id} Zeitüberschreitung (${timeoutMs}ms)`));
          }
        }, timeoutMs);
        pendingRef.current[id] = {
          resolve: (val) => {
            clearTimeout(timer);
            resolve(val as T);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        };
      }),
    [sendWs]
  );

  const fetchCameraImage = useCallback(
    async (entityPicturePath: string) => {
      const { ha_url, token } = configRef.current;
      if (!ha_url || !token) return;
      try {
        const cleanPath = entityPicturePath.startsWith("/")
          ? entityPicturePath
          : `/${entityPicturePath}`;
        const res = await fetch(`/api/ha-proxy${cleanPath}`, {
          headers: {
            "x-ha-url": ha_url,
            "x-ha-token": token,
          },
        });
        if (!res.ok) throw new Error("Kamera-Snapshot konnte nicht geladen werden");
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setState((prev) => {
          if (prev.camera_image_url?.startsWith("blob:")) {
            URL.revokeObjectURL(prev.camera_image_url);
          }
          return { ...prev, camera_image_url: objectUrl };
        });
      } catch (err) {
        console.error("Camera image fetch error:", err);
      }
    },
    []
  );

  const fetchHistory = useCallback(
    async (startIso?: string, endIso?: string) => {
      if (!state.connected) return;
      const cfg = configRef.current;
      const now = new Date();
      const startTime =
        startIso ?? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const statisticIds = [
        cfg.entities.solar_power,
        cfg.entities.grid_power,
        cfg.entities.battery_power,
        cfg.entities.battery_soc,
        cfg.entities.home_power,
        cfg.entities.water_today,
      ].filter(Boolean);

      if (statisticIds.length === 0) return;

      let rawStats: Record<string, RecorderStatPoint[]> = {};
      try {
        rawStats = await requestWs<Record<string, RecorderStatPoint[]>>(
          {
            type: "recorder/statistics_during_period",
            start_time: startTime,
            end_time: endIso,
            period: "hour",
            statistic_ids: statisticIds,
          },
          30000
        );
      } catch {
        try {
          let url = `/api/ha-proxy/recorder/statistics?start_time=${encodeURIComponent(
            startTime
          )}&period=hour&statistic_ids=${encodeURIComponent(statisticIds.join(","))}`;
          if (endIso) url += `&end_time=${encodeURIComponent(endIso)}`;
          const res = await fetch(url, {
            headers: {
              "x-ha-url": cfg.ha_url,
              "x-ha-token": cfg.token,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) rawStats = (await res.json()) as Record<string, RecorderStatPoint[]>;
        } catch (err) {
          console.error("History fetch failed:", err);
        }
      }

      const extractVal = (pt: RecorderStatPoint): number => {
        if (pt.mean !== undefined && pt.mean !== null) return pt.mean;
        if (pt.state !== undefined && pt.state !== null) {
          const n = parseFloat(String(pt.state));
          return Number.isNaN(n) ? 0 : n;
        }
        return 0;
      };

      const history: DashboardState["history"] = {
        solar: [],
        consumption: [],
        battery: [],
        water: [],
      };

      if (rawStats[cfg.entities.solar_power]) {
        history.solar = rawStats[cfg.entities.solar_power].map((p) => ({
          time: p.start,
          value: Math.max(0, extractVal(p)),
        }));
      }

      if (rawStats[cfg.entities.battery_power]) {
        history.battery = rawStats[cfg.entities.battery_power].map((p) => ({
          time: p.start,
          value: extractVal(p),
        }));
      }

      if (rawStats[cfg.entities.home_power]?.length) {
        history.consumption = rawStats[cfg.entities.home_power].map((p) => ({
          time: p.start,
          value: Math.max(0, extractVal(p)),
        }));
      } else if (rawStats[cfg.entities.solar_power] && rawStats[cfg.entities.grid_power]) {
        const solarPts = rawStats[cfg.entities.solar_power];
        const gridPts = rawStats[cfg.entities.grid_power];
        const batPts = rawStats[cfg.entities.battery_power] ?? [];

        const findClosest = (pts: RecorderStatPoint[], ts: number) =>
          pts.length > 0
            ? pts.reduce((best, cur) =>
                Math.abs(new Date(cur.start).getTime() - ts) <
                Math.abs(new Date(best.start).getTime() - ts)
                  ? cur
                  : best
              )
            : null;

        history.consumption = solarPts.map((sPt) => {
          const ts = new Date(sPt.start).getTime();
          const gPt = findClosest(gridPts, ts);
          const bPt = findClosest(batPts, ts);
          const val = computeHomePower(
            extractVal(sPt),
            gPt ? extractVal(gPt) : 0,
            bPt ? extractVal(bPt) : 0
          );
          return { time: sPt.start, value: val };
        });
      }

      if (cfg.entities.water_today && rawStats[cfg.entities.water_today]) {
        history.water = rawStats[cfg.entities.water_today].map((p) => ({
          time: p.start,
          value: extractVal(p),
        }));
      }

      setState((prev) => ({ ...prev, history }));
    },
    [state.connected, requestWs]
  );

  const fetchPeriodStats = useCallback(
    async (mode: Exclude<OverviewPeriod, "day">, startIso: string, endIso: string) => {
      if (!state.connected) return;
      const cfg = configRef.current;
      const ids = [
        cfg.entities.solar_today,
        cfg.entities.grid_import_today,
        cfg.entities.grid_export_today,
        cfg.entities.battery_discharge_today,
        cfg.entities.water_today,
      ].filter(Boolean);

      if (ids.length === 0) {
        setState((prev) => ({ ...prev, periodBuckets: [] }));
        return;
      }

      const haPeriod = mode === "year" ? "month" : "day";
      let raw: Record<string, RecorderStatPoint[]> = {};
      try {
        raw = await requestWs<Record<string, RecorderStatPoint[]>>(
          {
            type: "recorder/statistics_during_period",
            start_time: startIso,
            end_time: endIso,
            period: haPeriod,
            statistic_ids: ids,
          },
          30000
        );
      } catch {
        try {
          const url = `/api/ha-proxy/recorder/statistics?start_time=${encodeURIComponent(
            startIso
          )}&end_time=${encodeURIComponent(endIso)}&period=${haPeriod}&statistic_ids=${encodeURIComponent(
            ids.join(",")
          )}`;
          const res = await fetch(url, {
            headers: {
              "x-ha-url": cfg.ha_url,
              "x-ha-token": cfg.token,
              "Content-Type": "application/json",
            },
          });
          if (res.ok) raw = (await res.json()) as Record<string, RecorderStatPoint[]>;
        } catch (err) {
          console.error("Period stats fetch failed:", err);
        }
      }

      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      const getIsoWeek = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      };

      const bucketsMap = new Map<string, PeriodBucket>();

      const getKey = (startVal: string | number) => {
        const d = new Date(startVal);
        if (mode === "month") return `${d.getDate()}.`;
        if (mode === "quarter") return `KW ${getIsoWeek(d)}`;
        return monthNames[d.getMonth()];
      };

      for (const entityId of Object.keys(raw)) {
        for (const pt of raw[entityId]) {
          const key = getKey(pt.start);
          let b = bucketsMap.get(key);
          if (!b) {
            b = {
              label: key,
              solarKwh: 0,
              consumptionKwh: 0,
              gridImportKwh: 0,
              gridExportKwh: 0,
              batteryKwh: 0,
              waterL: 0,
            };
            bucketsMap.set(key, b);
          }
          const delta = Math.max(0, pt.change ?? 0);
          if (entityId === cfg.entities.solar_today) b.solarKwh += delta;
          if (entityId === cfg.entities.grid_import_today) b.gridImportKwh += delta;
          if (entityId === cfg.entities.grid_export_today) b.gridExportKwh += delta;
          if (entityId === cfg.entities.battery_discharge_today) b.batteryKwh += delta;
          if (entityId === cfg.entities.water_today) b.waterL += delta;
        }
      }

      const buckets = Array.from(bucketsMap.values()).map((b) => {
        const selfUsed = Math.max(0, b.solarKwh - b.gridExportKwh);
        return {
          ...b,
          solarKwh: Math.round(b.solarKwh * 10) / 10,
          gridImportKwh: Math.round(b.gridImportKwh * 10) / 10,
          gridExportKwh: Math.round(b.gridExportKwh * 10) / 10,
          batteryKwh: Math.round(b.batteryKwh * 10) / 10,
          consumptionKwh: Math.round((selfUsed + b.gridImportKwh) * 10) / 10,
          waterL: Math.round(b.waterL),
        };
      });

      setState((prev) => ({ ...prev, periodBuckets: buckets }));
    },
    [state.connected, requestWs]
  );

  const fetchStatistics = useCallback(async () => {
    if (!state.connected) return;
    const cfg = configRef.current;
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const ids = [
      cfg.entities.solar_today,
      cfg.entities.grid_import_today,
      cfg.entities.grid_export_today,
      cfg.entities.battery_discharge_today,
    ].filter(Boolean);

    if (ids.length === 0) return;

    try {
      let raw: Record<string, RecorderStatPoint[]> = {};
      try {
        raw = await requestWs<Record<string, RecorderStatPoint[]>>(
          {
            type: "recorder/statistics_during_period",
            start_time: startTime,
            period: "day",
            statistic_ids: ids,
          },
          30000
        );
      } catch {
        const res = await fetch(
          `/api/ha-proxy/recorder/statistics?start_time=${encodeURIComponent(
            startTime
          )}&period=day&statistic_ids=${encodeURIComponent(ids.join(","))}`,
          {
            headers: {
              "x-ha-url": cfg.ha_url,
              "x-ha-token": cfg.token,
              "Content-Type": "application/json",
            },
          }
        );
        if (!res.ok) return;
        raw = (await res.json()) as Record<string, RecorderStatPoint[]>;
      }

      const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
      const byMonth: Record<string, { solar: number; grid: number; battery: number; export: number }> = {};

      for (const entityId of Object.keys(raw)) {
        for (const pt of raw[entityId]) {
          const d = new Date(pt.start);
          const key = monthNames[d.getMonth()];
          if (!byMonth[key]) byMonth[key] = { solar: 0, grid: 0, battery: 0, export: 0 };
          const delta = pt.change ?? 0;
          if (entityId === cfg.entities.solar_today) byMonth[key].solar += delta;
          if (entityId === cfg.entities.grid_import_today) byMonth[key].grid += delta;
          if (entityId === cfg.entities.grid_export_today) byMonth[key].export += delta;
          if (entityId === cfg.entities.battery_discharge_today) byMonth[key].battery += delta;
        }
      }

      const monthly: MonthlyStat[] = Object.entries(byMonth)
        .map(([month, vals]) => ({
          month,
          solar: Math.round(vals.solar * 10) / 10,
          grid: Math.round(vals.grid * 10) / 10,
          battery: Math.round(vals.battery * 10) / 10,
          export: Math.round(vals.export * 10) / 10,
        }))
        .slice(-6);

      const weekly: WeeklyStat[] = [];
      const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      const solarDays = raw[cfg.entities.solar_today] ?? [];
      if (solarDays.length >= 14) {
        const last14 = solarDays.slice(-14);
        for (let i = 7; i < 14; i++) {
          const cur = last14[i];
          const prev = last14[i - 7];
          const d = new Date(cur.start);
          weekly.push({
            day: dayNames[d.getDay()],
            current: Math.round((cur.change ?? 0) * 10) / 10,
            previous: Math.round((prev.change ?? 0) * 10) / 10,
          });
        }
      }

      setState((prev) => ({
        ...prev,
        statistics: { monthly, weekly },
      }));
    } catch (err) {
      console.error("Statistics fetch error:", err);
    }
  }, [state.connected, requestWs]);

  const fetchHeatpumpAnalysis = useCallback(
    async (hours = 24) => {
      const cfg = configRef.current;
      if (!cfg.ha_url || !cfg.token) return;

      setState((prev) => ({
        ...prev,
        heatpump: { ...prev.heatpump, loading: true, error: null, hoursWindow: hours },
      }));

      const now = Date.now();
      const startIso = new Date(now - hours * 3600 * 1000).toISOString();
      const endIso = new Date(now).toISOString();

      const historyIds = [
        cfg.entities.hp_status,
        cfg.entities.hp_comp_starts,
        cfg.entities.hp_comp_hours,
        cfg.entities.hp_backup_hours,
      ].filter(Boolean);

      const statIds = [
        cfg.entities.hp_flow_temp,
        cfg.entities.hp_return_temp,
        cfg.entities.hp_outside_temp,
        cfg.entities.hp_source_in_temp,
        cfg.entities.hp_source_out_temp,
        cfg.entities.hp_room_temp,
      ].filter(Boolean);

      try {
        // 1. Fetch raw state history for status & counters
        const historyByEntity: Record<
          string,
          Array<{ state: string; last_changed: string }>
        > = {};

        if (historyIds.length > 0) {
          const histUrl = `/api/ha-proxy/history/period/${encodeURIComponent(
            startIso
          )}?end_time=${encodeURIComponent(endIso)}&filter_entity_id=${encodeURIComponent(
            historyIds.join(",")
          )}&minimal_response=1&significant_changes_only=1`;
          const res = await fetch(histUrl, {
            headers: {
              "x-ha-url": cfg.ha_url,
              "x-ha-token": cfg.token,
            },
          });
          if (res.ok) {
            const arr = (await res.json()) as Array<
              Array<{ entity_id?: string; state: string; last_changed: string }>
            >;
            if (Array.isArray(arr)) {
              for (const series of arr) {
                if (series.length > 0 && series[0].entity_id) {
                  historyByEntity[series[0].entity_id] = series;
                }
              }
            }
          }
        }

        // 2. Fetch hourly statistics for temperatures
        let statsByEntity: Record<string, RecorderStatPoint[]> = {};
        if (statIds.length > 0) {
          try {
            statsByEntity = await requestWs<Record<string, RecorderStatPoint[]>>(
              {
                type: "recorder/statistics_during_period",
                start_time: startIso,
                end_time: endIso,
                period: "hour",
                statistic_ids: statIds,
                types: ["mean", "min", "max"],
              },
              30000
            );
          } catch {
            const url = `/api/ha-proxy/recorder/statistics?start_time=${encodeURIComponent(
              startIso
            )}&end_time=${encodeURIComponent(
              endIso
            )}&period=hour&statistic_ids=${encodeURIComponent(statIds.join(","))}`;
            const res = await fetch(url, {
              headers: {
                "x-ha-url": cfg.ha_url,
                "x-ha-token": cfg.token,
                "Content-Type": "application/json",
              },
            });
            if (res.ok) statsByEntity = (await res.json()) as Record<string, RecorderStatPoint[]>;
          }
        }

        // 3. Analyze heat/standby/otshutdown cycles
        const statusPts = historyByEntity[cfg.entities.hp_status] ?? [];
        const segments: HeatpumpCycleSegment[] = [];
        for (let i = 0; i < statusPts.length; i++) {
          const cur = statusPts[i];
          const tStart = new Date(cur.last_changed).getTime();
          const tEnd =
            i + 1 < statusPts.length ? new Date(statusPts[i + 1].last_changed).getTime() : now;
          const durationMin = Math.max(0, (tEnd - tStart) / 60000);
          segments.push({
            status: cur.state,
            start: tStart,
            end: tEnd,
            durationMin: Math.round(durationMin * 10) / 10,
          });
        }

        const heatSegs = segments.filter((s) => s.status === "heat");
        const standbySegs = segments.filter((s) => s.status === "standby");
        const otShutdownCount = segments.filter((s) => s.status === "otshutdown").length;

        const avgHeatMinutes =
          heatSegs.length > 0
            ? Math.round(
                (heatSegs.reduce((a, b) => a + b.durationMin, 0) / heatSegs.length) * 10
              ) / 10
            : 0;
        const avgStandbyMinutes =
          standbySegs.length > 0
            ? Math.round(
                (standbySegs.reduce((a, b) => a + b.durationMin, 0) / standbySegs.length) * 10
              ) / 10
            : 0;

        const calcDelta = (entityId: string): number | null => {
          const pts = historyByEntity[entityId] ?? [];
          const nums = pts
            .map((p) => parseFloat(p.state))
            .filter((n) => !Number.isNaN(n));
          if (nums.length < 2) return null;
          return Math.round((nums[nums.length - 1] - nums[0]) * 10) / 10;
        };

        const compStartsDelta = calcDelta(cfg.entities.hp_comp_starts);
        const compHoursDelta = calcDelta(cfg.entities.hp_comp_hours);
        const backupHoursDelta = calcDelta(cfg.entities.hp_backup_hours);

        // 4. Merge hourly temperature series
        const hourMap = new Map<number, HeatpumpTempPoint>();
        const ensureBucket = (ts: number) => {
          let b = hourMap.get(ts);
          if (!b) {
            const d = new Date(ts);
            b = {
              time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              flow: null,
              returnTemp: null,
              outside: null,
              room: null,
              sourceIn: null,
              sourceOut: null,
              spread: null,
            };
            hourMap.set(ts, b);
          }
          return b;
        };

        const fillStat = (
          entityId: string,
          field: keyof Omit<HeatpumpTempPoint, "time" | "spread">
        ) => {
          for (const pt of statsByEntity[entityId] ?? []) {
            if (pt.mean === undefined || pt.mean === null) continue;
            const ts = new Date(pt.start).getTime();
            const b = ensureBucket(ts);
            b[field] = Math.round(pt.mean * 100) / 100;
          }
        };

        fillStat(cfg.entities.hp_flow_temp, "flow");
        fillStat(cfg.entities.hp_return_temp, "returnTemp");
        fillStat(cfg.entities.hp_outside_temp, "outside");
        fillStat(cfg.entities.hp_room_temp, "room");
        fillStat(cfg.entities.hp_source_in_temp, "sourceIn");
        fillStat(cfg.entities.hp_source_out_temp, "sourceOut");

        const tempSeries = Array.from(hourMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, pt]) => ({
            ...pt,
            spread:
              pt.flow !== null && pt.returnTemp !== null
                ? Math.round((pt.flow - pt.returnTemp) * 100) / 100
                : null,
          }));

        const avgOf = (vals: Array<number | null>) => {
          const valid = vals.filter((v): v is number => v !== null);
          if (valid.length === 0) return null;
          return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100;
        };

        const outsideStats = statsByEntity[cfg.entities.hp_outside_temp] ?? [];
        const outsideMins = outsideStats
          .map((p) => p.min ?? p.mean ?? null)
          .filter((v): v is number => v !== null);
        const outsideMaxs = outsideStats
          .map((p) => p.max ?? p.mean ?? null)
          .filter((v): v is number => v !== null);

        const sourceInAvg = avgOf(tempSeries.map((p) => p.sourceIn));
        const sourceOutAvg = avgOf(tempSeries.map((p) => p.sourceOut));

        setState((prev) => ({
          ...prev,
          heatpump: {
            loading: false,
            error: null,
            lastAnalyzed: Date.now(),
            hoursWindow: hours,
            heatCycles: heatSegs.length,
            avgHeatMinutes,
            avgStandbyMinutes,
            otShutdownCount,
            compStartsDelta,
            compHoursDelta,
            backupHoursDelta,
            avgSpreadK: avgOf(tempSeries.map((p) => p.spread)),
            outsideAvg: avgOf(tempSeries.map((p) => p.outside)),
            outsideMin:
              outsideMins.length > 0 ? Math.round(Math.min(...outsideMins) * 100) / 100 : null,
            outsideMax:
              outsideMaxs.length > 0 ? Math.round(Math.max(...outsideMaxs) * 100) / 100 : null,
            roomAvg: avgOf(tempSeries.map((p) => p.room)),
            sourceInAvg,
            sourceOutAvg,
            sourceSpreadK:
              sourceInAvg !== null && sourceOutAvg !== null
                ? Math.round((sourceInAvg - sourceOutAvg) * 100) / 100
                : null,
            tempSeries,
            recentCycles: segments.slice(-20).reverse(),
          },
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          heatpump: {
            ...prev.heatpump,
            loading: false,
            error: err instanceof Error ? err.message : "Wärmepumpen-Analyse fehlgeschlagen",
          },
        }));
      }
    },
    [requestWs]
  );

  const fetchEntities = useCallback(
    async (customUrl?: string, customToken?: string) => {
      const haUrl = customUrl ?? configRef.current.ha_url;
      const haToken = customToken ?? configRef.current.token;
      if (!haUrl || !haToken) return;

      setState((prev) => ({ ...prev, isFetchingEntities: true, entityError: null }));

      const sameCreds =
        haUrl === configRef.current.ha_url && haToken === configRef.current.token;
      if (state.connected && sameCreds) {
        try {
          const list = await requestWs<HaStateObj[]>({ type: "get_states" });
          if (Array.isArray(list)) {
            const options: EntityOption[] = list.map((item) => ({
              entity_id: item.entity_id,
              friendly_name: item.attributes?.friendly_name || item.entity_id,
              unit: item.attributes?.unit_of_measurement,
            }));
            setState((prev) => ({
              ...prev,
              availableEntities: options,
              isFetchingEntities: false,
              entityError: null,
            }));
            return;
          }
        } catch {
          // Fallback to REST proxy
        }
      }

      try {
        const res = await fetch("/api/ha-proxy/states", {
          headers: { "x-ha-url": haUrl, "x-ha-token": haToken },
        });
        const ct = res.headers.get("content-type") ?? "";
        if (!res.ok) {
          throw new Error(`Server-Fehler: ${res.status} ${res.statusText}`);
        }
        if (!ct.includes("application/json")) {
          throw new Error("Unerwartete Antwort (kein JSON). Prüfen Sie URL und Token.");
        }
        const data = (await res.json()) as HaStateObj[];
        if (!Array.isArray(data)) {
          throw new Error("Unerwartetes Antwortformat von Home Assistant.");
        }
        const options: EntityOption[] = data.map((item) => ({
          entity_id: item.entity_id,
          friendly_name: item.attributes?.friendly_name || item.entity_id,
          unit: item.attributes?.unit_of_measurement,
        }));
        setState((prev) => ({
          ...prev,
          availableEntities: options,
          isFetchingEntities: false,
          entityError: null,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Netzwerkfehler";
        setState((prev) => ({
          ...prev,
          isFetchingEntities: false,
          entityError: msg,
        }));
      }
    },
    [state.connected, requestWs]
  );

  const callService = useCallback(
    (domain: string, service: string, entityId: string, extra: Record<string, unknown> = {}) => {
      sendWs({
        type: "call_service",
        domain,
        service,
        service_data: { entity_id: entityId, ...extra },
      });
    },
    [sendWs]
  );

  useEffect(() => {
    if (state.connected) {
      fetchHistory();
      fetchStatistics();
    }
  }, [state.connected, fetchHistory, fetchStatistics]);

  useEffect(() => {
    if (state.connected) {
      sendWs({ type: "get_states" });
    }
  }, [state.connected, config.custom_flow_nodes, config.smart_devices, config.entities.top_consumers, sendWs]);

  useEffect(() => {
    if (!config.ha_url || !config.token) {
      setState((prev) => ({ ...prev, connected: false }));
      return;
    }

    let disposed = false;

    const applyEntityState = (
      entityId: string,
      newState: HaStateObj,
      draft: Partial<DashboardState>,
      deviceStates: Record<string, string>
    ) => {
      const cfg = configRef.current;
      const e = cfg.entities;
      const raw = newState.state;

      if (entityId === e.solar_power) draft.solar_power = parseNumOrZero(raw);
      if (entityId === e.grid_power) draft.grid_power = parseNumOrZero(raw);
      if (entityId === e.home_power) draft.home_power = parseNumOrZero(raw);
      if (entityId === e.battery_power) draft.battery_power = parseNumOrZero(raw);
      if (entityId === e.battery_soc) draft.battery_soc = parseNumOrNull(raw);
      if (entityId === e.battery_cycles) draft.battery_cycles = parseNumOrNull(raw);
      if (entityId === e.battery_discharge_today)
        draft.battery_discharge_today = parseNumOrNull(raw);
      if (entityId === e.solar_today) draft.solar_today = parseNumOrNull(raw);
      if (entityId === e.solar_forecast_today) draft.solar_forecast_today = parseNumOrNull(raw);
      if (entityId === e.solar_forecast_tomorrow) draft.solar_forecast_tomorrow = parseNumOrNull(raw);
      if (entityId === e.grid_import_today) draft.grid_import_today = parseNumOrNull(raw);
      if (entityId === e.grid_export_today) draft.grid_export_today = parseNumOrNull(raw);
      if (entityId === e.ev_range) draft.ev_range = parseNumOrNull(raw);
      if (entityId === e.ev_soc) draft.ev_soc = parseNumOrNull(raw);
      if (entityId === e.ev_charge_power) draft.ev_charge_power = parseNumOrNull(raw);
      if (entityId === e.water_meter) draft.water_meter = parseNumOrNull(raw);
      if (entityId === e.water_today) draft.water_today = parseNumOrNull(raw);
      if (entityId === e.water_temp) draft.water_temp = parseNumOrNull(raw);
      if (entityId === e.hp_status) draft.hp_live_status = raw;
      if (entityId === e.hp_flow_temp) draft.hp_live_flow = parseNumOrNull(raw);
      if (entityId === e.hp_return_temp) draft.hp_live_return = parseNumOrNull(raw);
      if (entityId === e.hp_outside_temp) draft.hp_live_outside = parseNumOrNull(raw);
      if (entityId === e.hp_room_temp) draft.hp_live_room = parseNumOrNull(raw);

      if (
        cfg.economic_settings.energy_price_mode === "entity" &&
        entityId === cfg.economic_settings.energy_price_entity
      ) {
        draft.current_energy_price = parseNumOrNull(raw);
      }

      if (entityId === e.motion_sensor_entity) {
        draft.motion_detected = raw === "on";
      }

      if (entityId === e.camera_entity && newState.attributes?.entity_picture) {
        fetchCameraImage(newState.attributes.entity_picture);
      }

      const tracked =
        cfg.smart_devices.some((d) => d.entity_id === entityId) ||
        (e.top_consumers ?? []).includes(entityId) ||
        (cfg.custom_flow_nodes ?? []).some((n) => n.entity_id === entityId);
      if (tracked) {
        deviceStates[entityId] = raw;
      }
    };

    const connect = () => {
      if (disposed) return;
      const base = config.ha_url.replace(/\/+$/, "");
      const wsUrl = base.replace(/^http(s?)/, "ws$1") + "/api/websocket";

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data as string);

          if (msg.id && pendingRef.current[msg.id]) {
            const { resolve, reject } = pendingRef.current[msg.id];
            delete pendingRef.current[msg.id];
            if (msg.success) resolve(msg.result);
            else reject(new Error(msg.error?.message || "WebSocket-Anfrage fehlgeschlagen"));
            return;
          }

          if (msg.type === "auth_required") {
            ws.send(JSON.stringify({ type: "auth", access_token: config.token }));
          } else if (msg.type === "auth_ok") {
            setState((prev) => ({ ...prev, connected: true, lastUpdated: Date.now() }));
            sendWs({ type: "subscribe_events", event_type: "state_changed" });
            sendWs({ type: "get_states" });
          } else if (msg.type === "event" && msg.event?.event_type === "state_changed") {
            const { entity_id, new_state } = msg.event.data as {
              entity_id: string;
              new_state: HaStateObj | null;
            };
            if (!new_state) return;

            setState((prev) => {
              const draft: Partial<DashboardState> = {};
              const deviceStates = { ...prev.device_states };
              applyEntityState(entity_id, new_state, draft, deviceStates);

              const next = {
                ...prev,
                ...draft,
                device_states: deviceStates,
                lastUpdated: Date.now(),
              };

              // Only compute home_power when no dedicated home_power entity is configured
              if (!configRef.current.entities.home_power) {
                next.home_power = computeHomePower(
                  next.solar_power,
                  next.grid_power,
                  next.battery_power
                );
              }
              return next;
            });
          } else if (msg.type === "result" && msg.success && Array.isArray(msg.result)) {
            const list = msg.result as HaStateObj[];
            const draft: Partial<DashboardState> = {};
            const deviceStates: Record<string, string> = {};
            const availableEntities: EntityOption[] = list.map((item) => ({
              entity_id: item.entity_id,
              friendly_name: item.attributes?.friendly_name || item.entity_id,
              unit: item.attributes?.unit_of_measurement,
            }));

            for (const item of list) {
              applyEntityState(item.entity_id, item, draft, deviceStates);
            }

            if (!configRef.current.entities.home_power || draft.home_power === undefined) {
              draft.home_power = computeHomePower(
                draft.solar_power ?? 0,
                draft.grid_power ?? 0,
                draft.battery_power ?? 0
              );
            }

            setState((prev) => ({
              ...prev,
              ...draft,
              device_states: deviceStates,
              availableEntities,
              lastUpdated: Date.now(),
            }));
          }
        };

        ws.onclose = () => {
          setState((prev) => ({ ...prev, connected: false }));
          if (!disposed) {
            reconnectTimerRef.current = setTimeout(connect, 5000);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error("WebSocket connection error:", err);
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [config.ha_url, config.token, sendWs, fetchCameraImage]);

  return {
    state,
    config,
    serverConfigLoaded,
    callService,
    updateConfig,
    fetchEntities,
    fetchHistory,
    fetchPeriodStats,
    fetchHeatpumpAnalysis,
  };
}
