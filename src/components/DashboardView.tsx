import { useEffect, useRef, useState } from "react";
import { Battery, Power, Sun, TrendingUp, Zap } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardConfig, DashboardState } from "../types/dashboard";
import { estimateBatteryRuntimeHours } from "../utils/energyMath";
import { cn, formatPower } from "../utils/formatters";
import { EnergyFlowSvg } from "./EnergyFlowSvg";

interface DashboardViewProps {
  state: DashboardState;
  config: DashboardConfig;
  layout: "pc" | "tablet" | "smartphone";
  onToggle: (entityId: string, currentState: string) => void;
  evChargerEntity: string;
}

interface LiveTrendPoint {
  time: string;
  home: number;
  solar: number;
}

export function DashboardView({
  state,
  config,
  layout,
  onToggle,
  evChargerEntity,
}: DashboardViewProps) {
  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";

  const [trend, setTrend] = useState<LiveTrendPoint[]>([]);
  const prevWaterRef = useRef(state.water_today ?? 0);
  const [waterFlowing, setWaterFlowing] = useState(false);
  const waterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate live trend from today's hourly history when available
  useEffect(() => {
    if (trend.length > 0) return;
    if (state.history.solar.length === 0 && state.history.consumption.length === 0) return;

    const seeded: LiveTrendPoint[] = state.history.solar.slice(-12).map((s, idx) => {
      const c = state.history.consumption[idx];
      const d = new Date(s.time);
      return {
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        solar: Number((s.value / 1000).toFixed(2)),
        home: Number(((c?.value ?? 0) / 1000).toFixed(2)),
      };
    });
    if (seeded.length > 0) setTrend(seeded);
  }, [state.history.solar, state.history.consumption, trend.length]);

  useEffect(() => {
    const cur = state.water_today ?? 0;
    if (cur > prevWaterRef.current) {
      setWaterFlowing(true);
      if (waterTimerRef.current) clearTimeout(waterTimerRef.current);
      waterTimerRef.current = setTimeout(() => setWaterFlowing(false), 15000);
      prevWaterRef.current = cur;
    } else if (cur < prevWaterRef.current) {
      prevWaterRef.current = cur;
      setWaterFlowing(false);
    }
  }, [state.water_today]);

  useEffect(() => {
    if (!state.connected) return;
    const pt: LiveTrendPoint = {
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      home: Number((state.home_power / 1000).toFixed(2)),
      solar: Number((state.solar_power / 1000).toFixed(2)),
    };
    setTrend((prev) => {
      const next = [...prev, pt];
      return next.length > 100 ? next.slice(1) : next;
    });
  }, [state.connected, state.home_power, state.solar_power]);

  const evState = state.device_states[evChargerEntity] || "off";
  const evCharging = evState === "on";
  const batteryRuntime = estimateBatteryRuntimeHours(
    state.battery_soc,
    state.battery_power,
    config.battery_settings.capacity_kwh
  );

  return (
    <main className={cn("flex-1 p-8 overflow-y-auto bg-bg", isPhone && "p-4")}>
      <div
        className={cn(
          "grid grid-cols-12 gap-6",
          isPhone && "grid-cols-1 gap-4",
          isTablet && "grid-cols-1 gap-5"
        )}
      >
        <section
          className={cn(
            "col-span-12 lg:col-span-8 glass rounded-3xl p-8 flex flex-col items-center justify-center min-h-[500px]",
            isPhone && "px-2 py-5 min-h-[340px]",
            isTablet && "p-6 min-h-[400px]"
          )}
        >
          <EnergyFlowSvg
            state={state}
            waterFlowing={waterFlowing}
            widgetScale={config.ui_settings.widget_scale}
            isPhone={isPhone}
          />
        </section>

        <div
          className={cn(
            "col-span-12 lg:col-span-4 flex flex-col gap-4",
            (isPhone || isTablet) && "col-span-1"
          )}
        >
          <StatusCard
            icon={Sun}
            label="Solarproduktion"
            value={formatPower(state.solar_power)}
            badge={`Heute: ${(state.solar_today ?? 0).toFixed(1)} kWh`}
            color="text-solar"
            bg="bg-solar/10"
            border="border-solar/20"
            isPhone={isPhone}
          />
          <StatusCard
            icon={Zap}
            label="Netzverbrauch"
            value={`${
              state.grid_power > 0
                ? "Bezug: "
                : state.grid_power < 0
                ? "Einspeisung: "
                : ""
            }${formatPower(state.grid_power)}`}
            badge={`Heute: ${(state.grid_import_today ?? 0).toFixed(1)} kWh`}
            color="text-grid"
            bg="bg-grid/10"
            border="border-grid/20"
            negative={state.grid_power > 0}
            isPhone={isPhone}
          />
          <StatusCard
            icon={Battery}
            label="Batteriestand"
            value={`${state.battery_soc ?? 0}%`}
            badge={
              batteryRuntime ??
              `${
                state.battery_power > 0
                  ? "Laden: "
                  : state.battery_power < 0
                  ? "Entladen: "
                  : ""
              }${formatPower(state.battery_power)}`
            }
            color="text-battery"
            bg="bg-battery/10"
            border="border-battery/20"
            isPhone={isPhone}
          />
        </div>

        <div
          className={cn(
            "col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
            (isPhone || isTablet) && "grid-cols-2"
          )}
        >
          <MiniStat
            label="Solar Prognose"
            value={`${(state.solar_forecast_today ?? 0).toFixed(1)} kWh`}
            icon={Sun}
            color="text-solar"
            isPhone={isPhone}
          />
          <MiniStat
            label="Netz Einspeisung"
            value={`${(state.grid_export_today ?? 0).toFixed(1)} kWh`}
            icon={Zap}
            color="text-grid"
            isPhone={isPhone}
          />
          <MiniStat
            label="Netz Bezug"
            value={`${(state.grid_import_today ?? 0).toFixed(1)} kWh`}
            icon={Zap}
            color="text-red-400"
            isPhone={isPhone}
          />
          <MiniStat
            label="Batterie Leistung"
            value={formatPower(state.battery_power)}
            icon={Battery}
            color="text-battery"
            isPhone={isPhone}
          />
        </div>

        {/* EV Charging */}
        <section
          className={cn(
            "col-span-12 lg:col-span-5 glass rounded-3xl p-8 flex flex-col gap-6",
            isPhone && "p-6",
            isTablet && "p-7"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20 text-accent">
                <Zap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">E-Auto Laden</h2>
            </div>
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold",
                evCharging
                  ? "bg-green-500/10 text-green-400 animate-pulse"
                  : "bg-slate-500/10 text-slate-400"
              )}
            >
              {evCharging ? "Lädt" : "Bereit"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface/50 border border-border p-4 rounded-2xl">
              <span className="text-xs text-slate-500 font-medium block mb-1">Batteriestand</span>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold">{state.ev_soc ?? 0}%</span>
                <div className="w-full bg-slate-800 h-2 rounded-full mb-2 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, state.ev_soc ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-surface/50 border border-border p-4 rounded-2xl">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                Gesch. Reichweite
              </span>
              <span className="text-2xl font-bold">{state.ev_range ?? 0} km</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-surface p-4 rounded-2xl border border-border">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Ladeleistung</span>
              <span className="text-lg font-bold text-accent">
                {formatPower(state.ev_charge_power ?? 0)}
              </span>
            </div>
            <button
              onClick={() => onToggle(evChargerEntity, evState)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 cursor-pointer",
                evCharging
                  ? "bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20"
                  : "bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
              )}
            >
              <Power className="w-4 h-4" />
              {evCharging ? "Stopp" : "Start"}
            </button>
          </div>
        </section>

        {/* Live Trend */}
        <section className="col-span-12 lg:col-span-7 glass rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Hausverbrauch Trend</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-xs text-slate-400">Verbrauch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-solar" />
                <span className="text-xs text-slate-400">Solar</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full relative">
            {trend.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/20 rounded-2xl border border-dashed border-border gap-3">
                <TrendingUp className="w-8 h-8 text-slate-600" />
                <p className="text-slate-500 text-sm font-medium">
                  Warte auf Verlaufsdaten von Home Assistant...
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="dashColorSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#32d7ff" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#32d7ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashColorHome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252b38" vertical={false} />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    unit=" kW"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#161a23",
                      border: "1px solid #252b38",
                      borderRadius: "12px",
                    }}
                    itemStyle={{ fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="solar"
                    stroke="#32d7ff"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashColorSolar)"
                    name="Solarproduktion (kW)"
                  />
                  <Area
                    type="monotone"
                    dataKey="home"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dashColorHome)"
                    name="Hausverbrauch (kW)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  badge,
  color,
  bg,
  border,
  negative,
  isPhone,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  negative?: boolean;
  isPhone: boolean;
}) {
  return (
    <div
      className={cn(
        "p-6 rounded-3xl border flex items-center justify-between transition-all duration-300 hover:scale-[1.01]",
        bg,
        border,
        isPhone && "p-4 rounded-2xl"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "p-3 rounded-2xl bg-bg border border-border",
            color,
            isPhone && "p-2 rounded-xl"
          )}
        >
          <Icon className={cn("w-6 h-6", isPhone && "w-4 h-4")} />
        </div>
        <div className="flex flex-col">
          <span className={cn("text-sm font-medium text-slate-400", isPhone && "text-xs")}>
            {label}
          </span>
          <span className={cn("text-xl font-bold", isPhone && "text-lg")}>{value}</span>
        </div>
      </div>
      <div
        className={cn(
          "px-3 py-1 rounded-full text-xs font-bold",
          negative ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400",
          isPhone && "px-2 py-0.5 text-[10px]"
        )}
      >
        {badge}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
  isPhone,
}: {
  label: string;
  value: string;
  icon: typeof Sun;
  color: string;
  isPhone: boolean;
}) {
  return (
    <div className={cn("glass p-4 rounded-2xl flex items-center gap-4", isPhone && "p-3 gap-2")}>
      <div
        className={cn(
          "p-2 rounded-xl bg-surface border border-border",
          color,
          isPhone && "p-1.5 rounded-lg"
        )}
      >
        <Icon className={cn("w-5 h-5", isPhone && "w-4 h-4")} />
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            "text-[10px] font-bold text-slate-500 uppercase tracking-wider",
            isPhone && "text-[10px]"
          )}
        >
          {label}
        </span>
        <span className={cn("text-sm font-bold", isPhone && "text-sm")}>{value}</span>
      </div>
    </div>
  );
}
