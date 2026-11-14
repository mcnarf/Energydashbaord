import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Droplets,
  ShieldCheck,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardConfig, DashboardState, OverviewPeriod } from "../types/dashboard";
import {
  computeAutarkyPercent,
  computeDailySavings,
  computeNetGridKwh,
  HourlyBucket,
} from "../utils/energyMath";
import { cn, getWaterColor } from "../utils/formatters";

interface OverviewViewProps {
  state: DashboardState;
  config: DashboardConfig;
  layout: "pc" | "tablet" | "smartphone";
  fetchHistory: (startIso?: string, endIso?: string) => Promise<void>;
  fetchPeriodStats: (
    mode: Exclude<OverviewPeriod, "day">,
    startIso: string,
    endIso: string
  ) => Promise<void>;
}

const PERIOD_TABS: Array<{ id: OverviewPeriod; label: string }> = [
  { id: "day", label: "Tag" },
  { id: "month", label: "Monat" },
  { id: "quarter", label: "Quartal" },
  { id: "year", label: "Jahr" },
];

function getPeriodRange(period: OverviewPeriod, refDateStr: string) {
  const ref = new Date(refDateStr);
  if (period === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = start.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    return { start, end, label };
  }
  if (period === "quarter") {
    const q = Math.floor(ref.getMonth() / 3);
    const start = new Date(ref.getFullYear(), q * 3, 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    const label = `Q${q + 1} ${ref.getFullYear()}`;
    return { start, end, label };
  }
  const start = new Date(ref.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
  const label = `${ref.getFullYear()}`;
  return { start, end, label };
}

export function OverviewView({
  state,
  config,
  layout,
  fetchHistory,
  fetchPeriodStats,
}: OverviewViewProps) {
  const [period, setPeriod] = useState<OverviewPeriod>("day");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isToday, setIsToday] = useState(true);

  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";

  useEffect(() => {
    if (period === "day") {
      const today = new Date().toISOString().split("T")[0];
      if (selectedDate === today) {
        setIsToday(true);
        fetchHistory();
      } else {
        setIsToday(false);
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        fetchHistory(start.toISOString(), end.toISOString());
      }
    } else {
      setIsToday(false);
      const { start, end } = getPeriodRange(period, selectedDate);
      fetchPeriodStats(period, start.toISOString(), end.toISOString());
    }
  }, [period, selectedDate, fetchHistory, fetchPeriodStats]);

  const hourlyData: HourlyBucket[] = useMemo(() => {
    if (!state.history.solar.length && !state.history.consumption.length) return [];
    const result: HourlyBucket[] = [];
    const baseDate = new Date(selectedDate);
    let lastSolar = 0;
    let lastCons = 0;
    let lastBat = 0;
    const maxHour = isToday ? new Date().getHours() : 23;

    for (let h = 0; h <= maxHour; h++) {
      const slotStart = new Date(baseDate);
      slotStart.setHours(h, 0, 0, 0);
      const t0 = slotStart.getTime();
      const t1 = t0 + 3600 * 1000;

      const avg = (pts: typeof state.history.solar, prevVal: number) => {
        const inSlot = pts.filter((p) => {
          const ts = new Date(p.time).getTime();
          return ts >= t0 && ts < t1;
        });
        if (inSlot.length > 0) return inSlot.reduce((s, p) => s + p.value, 0) / inSlot.length;
        if (h === 0) {
          const before = pts.filter((p) => new Date(p.time).getTime() < t0).pop();
          if (before) return before.value;
        }
        return prevVal;
      };

      lastSolar = avg(state.history.solar, lastSolar);
      lastCons = avg(state.history.consumption, lastCons);
      lastBat = avg(state.history.battery, lastBat);

      result.push({
        time: `${h}:00`,
        solar: Math.round(lastSolar),
        consumption: Math.round(lastCons),
        battery: Math.round(lastBat),
      });
    }
    return result;
  }, [state.history, selectedDate, isToday]);

  const activePrice =
    config.economic_settings.energy_price_mode === "entity" && state.current_energy_price !== null
      ? state.current_energy_price
      : config.economic_settings.energy_price || 0.35;

  const periodTotals = useMemo(() => {
    if (period === "day") return null;
    return state.periodBuckets.reduce(
      (acc, b) => {
        acc.solarKwh += b.solarKwh;
        acc.importKwh += b.gridImportKwh;
        acc.exportKwh += b.gridExportKwh;
        acc.consumptionKwh += b.consumptionKwh;
        acc.waterL += b.waterL;
        return acc;
      },
      { solarKwh: 0, importKwh: 0, exportKwh: 0, consumptionKwh: 0, waterL: 0 }
    );
  }, [period, state.periodBuckets]);

  const autarky = useMemo(() => {
    if (period === "day") return computeAutarkyPercent(hourlyData);
    if (!periodTotals || periodTotals.consumptionKwh <= 0) return 0;
    const selfUsed = Math.max(0, periodTotals.solarKwh - periodTotals.exportKwh);
    return Math.min(100, Math.max(0, Math.round((selfUsed / periodTotals.consumptionKwh) * 100)));
  }, [period, hourlyData, periodTotals]);

  const netGridKwh = useMemo(() => {
    if (period === "day") return computeNetGridKwh(hourlyData);
    if (!periodTotals) return 0;
    return periodTotals.importKwh - periodTotals.exportKwh;
  }, [period, hourlyData, periodTotals]);

  const savings = useMemo(() => {
    const feedIn = config.economic_settings.feed_in_tariff || 0;
    if (period === "day") return computeDailySavings(hourlyData, activePrice, feedIn);
    if (!periodTotals) return 0;
    const selfUsed = Math.max(0, periodTotals.solarKwh - periodTotals.exportKwh);
    return selfUsed * activePrice + periodTotals.exportKwh * feedIn;
  }, [period, hourlyData, periodTotals, activePrice, config.economic_settings.feed_in_tariff]);

  const co2SavedKg = useMemo(() => {
    const solarKwh =
      period === "day"
        ? hourlyData.reduce((s, h) => s + h.solar, 0) / 1000
        : periodTotals?.solarKwh ?? 0;
    return solarKwh * (config.economic_settings.co2_factor || 0.4);
  }, [period, hourlyData, periodTotals, config.economic_settings.co2_factor]);

  const topConsumers = useMemo(() => {
    return (config.entities.top_consumers || []).map((entityId) => {
      const raw = state.device_states[entityId];
      const val = parseFloat(raw ?? "0") || 0;
      const meta = state.availableEntities.find((e) => e.entity_id === entityId);
      const isPower =
        meta?.unit === "W" || entityId.includes("power") || entityId.includes("nrg");
      const unit = meta?.unit || (isPower ? "W" : "kWh");
      const refPower = state.home_power || 1000;
      const pct = isPower ? Math.min(100, Math.round((val / refPower) * 100)) : Math.min(100, Math.round(val * 10));
      const label =
        meta?.friendly_name ||
        entityId
          .split(".")[1]
          ?.replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()) ||
        entityId;

      return { id: entityId, name: label, value: `${val} ${unit}`, percentage: pct };
    });
  }, [config.entities.top_consumers, state.device_states, state.availableEntities, state.home_power]);

  const waterColor = getWaterColor(state.water_temp);
  const waterInfo = useMemo(() => {
    if (period !== "day") {
      return { value: periodTotals?.waterL ?? 0, temp: null };
    }
    if (isToday) return { value: state.water_today ?? 0, temp: state.water_temp };
    const last = state.history.water[state.history.water.length - 1];
    return { value: last ? Math.round(last.value) : 0, temp: null };
  }, [period, periodTotals, isToday, state.water_today, state.water_temp, state.history.water]);

  const dateLabel = useMemo(() => {
    if (period !== "day") return getPeriodRange(period, selectedDate).label;
    return isToday
      ? "Heute"
      : new Date(selectedDate).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  }, [period, selectedDate, isToday]);

  const isNextDisabled = useMemo(() => {
    const now = new Date();
    if (period === "day") return isToday;
    const { end } = getPeriodRange(period, selectedDate);
    return end >= now;
  }, [period, selectedDate, isToday]);

  const shiftPeriod = (dir: -1 | 1) => {
    const d = new Date(selectedDate);
    if (period === "day") d.setDate(d.getDate() + dir);
    else if (period === "month") d.setMonth(d.getMonth() + dir);
    else if (period === "quarter") d.setMonth(d.getMonth() + dir * 3);
    else d.setFullYear(d.getFullYear() + dir);

    if (dir > 0) {
      const now = new Date();
      if (period === "day" && d > now) return;
      if (period !== "day" && getPeriodRange(period, d.toISOString().split("T")[0]).start > now) {
        return;
      }
    }
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const pieData = [
    { name: "Solar/Batterie", value: autarky, color: "#32d7ff" },
    { name: "Netz", value: Math.max(0, 100 - autarky), color: "#1E293B" },
  ];

  const forecastData = [
    {
      name: "Heute",
      forecast: state.solar_forecast_today ?? 0,
      actual: state.solar_today ?? 0,
    },
    ...(state.solar_forecast_tomorrow !== null
      ? [{ name: "Morgen", forecast: state.solar_forecast_tomorrow, actual: 0 }]
      : []),
  ];

  return (
    <div
      className={cn(
        "flex-1 p-12 flex flex-col gap-8 overflow-y-auto bg-bg",
        isPhone && "p-4 gap-4",
        isTablet && "p-8 gap-6"
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between",
          isPhone && "flex-col gap-4 items-start"
        )}
      >
        <div className="flex flex-col gap-2">
          <h1 className={cn("text-3xl font-bold tracking-tight", isPhone && "text-2xl")}>
            Energieübersicht
          </h1>
          <p className="text-slate-500 text-sm">
            Detaillierte Analyse Ihres Energie-Ökosystems für{" "}
            {isToday ? "den heutigen Tag" : dateLabel}.
          </p>
        </div>

        <div className={cn("flex items-center gap-3 flex-wrap", isPhone && "w-full")}>
          <div className="flex bg-surface p-1 rounded-2xl border border-border">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  period === tab.id
                    ? "bg-solar text-bg shadow-lg"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className={cn(
              "flex items-center gap-2 bg-surface p-2 rounded-2xl border border-border shadow-sm",
              isPhone && "w-full justify-between"
            )}
          >
            <button
              onClick={() => shiftPeriod(-1)}
              className="p-2 hover:bg-bg rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Zurück"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {period === "day" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-bg/50 rounded-xl border border-border">
                <Calendar className="w-4 h-4 text-solar" />
                <input
                  type="date"
                  value={selectedDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer [color-scheme:dark]"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-bg/50 rounded-xl border border-border min-w-[130px] justify-center">
                <Calendar className="w-4 h-4 text-solar" />
                <span className="text-sm font-bold">{dateLabel}</span>
              </div>
            )}
            <button
              onClick={() => shiftPeriod(1)}
              disabled={isNextDisabled}
              className={cn(
                "p-2 rounded-xl transition-all",
                isNextDisabled
                  ? "text-slate-700 cursor-not-allowed"
                  : "text-slate-400 hover:text-white hover:bg-bg cursor-pointer"
              )}
              title="Vor"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6",
          isPhone && "grid-cols-2 gap-3",
          isTablet && "grid-cols-3 gap-4"
        )}
      >
        <KpiCard
          title="Autarkiegrad"
          value={`${autarky}%`}
          subValue={dateLabel}
          icon={ShieldCheck}
          badge={autarky >= 50 ? "Gut" : "Niedrig"}
          positive={autarky >= 50}
          color="text-solar"
          isPhone={isPhone}
        />
        <KpiCard
          title="Ersparnis"
          value={`€${savings.toFixed(2)}`}
          subValue={dateLabel}
          icon={DollarSign}
          badge={`€${activePrice.toFixed(2)}/kWh`}
          positive
          color="text-battery"
          isPhone={isPhone}
        />
        <KpiCard
          title="Netzbilanz"
          value={`${netGridKwh.toFixed(1)} kWh`}
          subValue={dateLabel}
          icon={Zap}
          badge={netGridKwh < 0 ? "Überschuss" : "Bezug"}
          positive={netGridKwh < 0}
          color="text-blue-400"
          isPhone={isPhone}
        />
        <KpiCard
          title="CO₂ vermieden"
          value={`${co2SavedKg.toFixed(1)} kg`}
          subValue={dateLabel}
          icon={Sun}
          badge={`${config.economic_settings.co2_factor} kg/kWh`}
          positive
          color="text-yellow-400"
          isPhone={isPhone}
        />
        <KpiCard
          title="Wasserverbrauch"
          value={`${waterInfo.value} L`}
          subValue={
            waterInfo.temp !== null ? `${dateLabel} | ${waterInfo.temp}°C` : dateLabel
          }
          icon={Droplets}
          badge={`${state.water_meter ?? 0} m³`}
          positive
          iconStyle={{ color: waterColor.base }}
          isPhone={isPhone}
        />
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8", isPhone && "gap-4", isTablet && "gap-6")}>
        <div
          className={cn(
            "lg:col-span-2 glass p-8 rounded-[32px] flex flex-col gap-6",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-solar" />
              Leistungsverlauf ({dateLabel})
            </h2>
            {!isPhone && (
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-solar" /> Solar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-400" /> Verbrauch
                </span>
              </div>
            )}
          </div>

          <div className={cn("h-[350px] w-full relative", isPhone && "h-[250px]")}>
            {period === "day" ? (
              hourlyData.length === 0 ? (
                <EmptyChart label="Keine Verlaufsdaten vorhanden" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="ovColorSolar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#32d7ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#32d7ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ovColorCons" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval={3}
                    />
                    <YAxis
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}W`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        border: "1px solid #1E293B",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      itemStyle={{ fontWeight: "bold" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="solar"
                      name="Solar (W)"
                      stroke="#32d7ff"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#ovColorSolar)"
                    />
                    <Area
                      type="monotone"
                      dataKey="consumption"
                      name="Verbrauch (W)"
                      stroke="#94A3B8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#ovColorCons)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            ) : state.periodBuckets.length === 0 ? (
              <EmptyChart label="Keine Statistikdaten für diesen Zeitraum vorhanden" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={state.periodBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#475569"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v} kWh`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ fontWeight: "bold" }}
                  />
                  <Legend />
                  <Bar
                    dataKey="solarKwh"
                    name="Solar (kWh)"
                    fill="#32d7ff"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="consumptionKwh"
                    name="Verbrauch (kWh)"
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div
          className={cn(
            "glass p-8 rounded-[32px] flex flex-col gap-6 items-center justify-center text-center",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <h2 className="text-xl font-bold self-start">Autarkie-Mix</h2>
          <div className={cn("h-[250px] w-full relative", isPhone && "h-[200px]")}>
            {(period === "day" ? hourlyData.length === 0 : state.periodBuckets.length === 0) ? (
              <EmptyChart label="Keine Daten vorhanden" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isPhone ? 50 : 60}
                      outerRadius={isPhone ? 70 : 80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={cn("text-4xl font-bold", isPhone && "text-3xl")}>{autarky}%</span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    Grün
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Solar + Batterie</span>
              <span className="font-bold text-solar">{autarky}%</span>
            </div>
            <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
              <div className="bg-solar h-full" style={{ width: `${autarky}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isPhone && "gap-4", isTablet && "gap-6")}>
        <div
          className={cn(
            "glass p-8 rounded-[32px] flex flex-col gap-6",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sun className="w-5 h-5 text-yellow-400" />
            Solar Prognose vs Realität
          </h2>
          <div className={cn("h-[250px] w-full relative", isPhone && "h-[200px]")}>
            {state.solar_forecast_today === null && state.solar_today === null ? (
              <EmptyChart label="Prognose-Entität in den Einstellungen konfigurieren" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}kWh`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="forecast" name="Prognose" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="Tatsächlich" fill="#F27D26" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div
          className={cn(
            "glass p-8 rounded-[32px] flex flex-col gap-6",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-battery" />
            Top Verbraucher
          </h2>
          <div className="flex flex-col gap-4">
            {topConsumers.length > 0 ? (
              topConsumers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 p-4 bg-surface/30 rounded-2xl border border-border/50 hover:border-border transition-colors"
                >
                  <div className="p-3 rounded-xl text-white bg-solar/20 border border-solar/30">
                    <Zap className="w-5 h-5 text-solar" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">{c.name}</span>
                      <span className="text-xs font-bold">{c.value}</span>
                    </div>
                    <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-solar" style={{ width: `${c.percentage}%` }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm italic">
                Keine Top-Verbraucher in den Einstellungen konfiguriert.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/20 rounded-2xl border border-dashed border-border gap-3">
      <TrendingUp className="w-8 h-8 text-slate-600" />
      <p className="text-slate-500 text-sm font-medium text-center px-4">{label}</p>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subValue,
  icon: Icon,
  badge,
  positive,
  color,
  iconStyle,
  isPhone,
}: {
  title: string;
  value: string;
  subValue: string;
  icon: typeof Sun;
  badge: string;
  positive: boolean;
  color?: string;
  iconStyle?: React.CSSProperties;
  isPhone: boolean;
}) {
  return (
    <div
      className={cn(
        "glass p-6 rounded-3xl flex flex-col gap-4 group hover:border-solar/30 transition-all duration-300",
        isPhone && "p-4 gap-2 rounded-2xl"
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "p-2 rounded-xl bg-surface border border-border group-hover:border-solar/20 transition-colors",
            color,
            isPhone && "p-1.5"
          )}
          style={iconStyle}
        >
          <Icon className={cn("w-5 h-5", isPhone && "w-4 h-4")} />
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
            positive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500",
            isPhone && "px-1.5 py-0.5 text-[8px]"
          )}
        >
          {positive ? (
            <ArrowUpRight className={cn("w-3 h-3", isPhone && "w-2 h-2")} />
          ) : (
            <ArrowDownRight className={cn("w-3 h-3", isPhone && "w-2 h-2")} />
          )}
          {badge}
        </div>
      </div>
      <div className="flex flex-col">
        <span className={cn("text-2xl font-bold tracking-tight", isPhone && "text-lg")}>
          {value}
        </span>
        <span
          className={cn(
            "text-xs font-bold text-slate-500 uppercase tracking-wider",
            isPhone && "text-[10px]"
          )}
        >
          {title}
        </span>
        <span className={cn("text-[10px] text-slate-600 mt-1", isPhone && "text-[8px] mt-0.5")}>
          {subValue}
        </span>
      </div>
    </div>
  );
}
