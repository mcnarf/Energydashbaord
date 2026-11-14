import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Battery,
  Calendar,
  DollarSign,
  ShieldCheck,
  Sun,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardConfig, DashboardState } from "../types/dashboard";
import { cn, formatPower } from "../utils/formatters";

interface TrendsViewProps {
  state: DashboardState;
  config: DashboardConfig;
  layout: "pc" | "tablet" | "smartphone";
}

export function TrendsView({ state, config, layout }: TrendsViewProps) {
  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";

  const monthlyData = state.statistics.monthly;
  const weeklyData = state.statistics.weekly;

  const activePrice =
    config.economic_settings.energy_price_mode === "entity" && state.current_energy_price !== null
      ? state.current_energy_price
      : config.economic_settings.energy_price || 0.35;
  const feedIn = config.economic_settings.feed_in_tariff || 0;

  // Real cumulative savings derived from monthly Home Assistant statistics
  const cumulativeSavings = useMemo(() => {
    let running = 0;
    return monthlyData.map((m) => {
      const selfConsumed = Math.max(0, m.solar - m.export);
      const monthEur = selfConsumed * activePrice + m.export * feedIn;
      running += monthEur;
      return { month: m.month, savings: Math.round(running) };
    });
  }, [monthlyData, activePrice, feedIn]);

  // Real monthly autarky computed from monthly solar/export vs grid import
  const monthlyAutarky = useMemo(() => {
    const totals = monthlyData.reduce(
      (acc, m) => {
        const selfUsed = Math.max(0, m.solar - m.export);
        const totalCons = selfUsed + m.grid;
        acc.selfUsed += selfUsed;
        acc.totalCons += totalCons;
        return acc;
      },
      { selfUsed: 0, totalCons: 0 }
    );
    if (totals.totalCons <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((totals.selfUsed / totals.totalCons) * 100)));
  }, [monthlyData]);

  const weeklyCurrentKwh = useMemo(
    () => weeklyData.reduce((acc, d) => acc + d.current, 0),
    [weeklyData]
  );
  const weeklyPrevKwh = useMemo(
    () => weeklyData.reduce((acc, d) => acc + d.previous, 0),
    [weeklyData]
  );
  const weeklyDiffPct =
    weeklyPrevKwh > 0
      ? Math.round(((weeklyCurrentKwh - weeklyPrevKwh) / weeklyPrevKwh) * 100)
      : 0;

  const todaySavings = useMemo(() => {
    const solar = state.solar_today ?? 0;
    const exported = state.grid_export_today ?? 0;
    const selfUsed = Math.max(0, solar - exported);
    return selfUsed * activePrice + exported * feedIn;
  }, [state.solar_today, state.grid_export_today, activePrice, feedIn]);

  const cyclePct =
    state.battery_cycles !== null && config.battery_settings.max_cycles > 0
      ? Math.min(100, Math.round((state.battery_cycles / config.battery_settings.max_cycles) * 100))
      : 0;

  return (
    <div
      className={cn(
        "flex-1 p-12 flex flex-col gap-8 overflow-y-auto bg-bg",
        isPhone && "p-4 gap-4",
        isTablet && "p-8 gap-6"
      )}
    >
      <header className="flex flex-col gap-2">
        <h1 className={cn("text-3xl font-bold tracking-tight", isPhone && "text-2xl")}>
          Energietrends
        </h1>
        <p className="text-slate-500 text-sm">
          Langzeitanalyse und Effizienzmuster Ihrer Solaranlage.
        </p>
      </header>

      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-3 gap-6",
          isPhone && "grid-cols-1 gap-3",
          isTablet && "grid-cols-2 gap-4"
        )}
      >
        <TrendCard
          title="Langzeit-Autarkie"
          value={`${monthlyAutarky}%`}
          trend={monthlyData.length > 0 ? `${monthlyData.length} Monate` : "Keine Daten"}
          trendUp={monthlyAutarky >= 50}
          icon={ShieldCheck}
          color="text-solar"
          isPhone={isPhone}
        />
        <TrendCard
          title="Solarertrag (Woche)"
          value={`${weeklyCurrentKwh.toFixed(1)} kWh`}
          trend={`${weeklyDiffPct >= 0 ? "+" : ""}${weeklyDiffPct}% vs. Vorwoche`}
          trendUp={weeklyDiffPct >= 0}
          icon={Sun}
          color="text-yellow-400"
          isPhone={isPhone}
        />
        <TrendCard
          title="Ersparnis Heute"
          value={`€${todaySavings.toFixed(2)}`}
          trend={`€${activePrice.toFixed(2)}/kWh`}
          trendUp
          icon={DollarSign}
          color="text-battery"
          isPhone={isPhone}
        />
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isPhone && "gap-4", isTablet && "gap-6")}>
        <div
          className={cn(
            "glass p-8 rounded-[32px] flex flex-col gap-6",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-solar" />
              Monatliche Energiebilanz
            </h2>
            <span className="text-xs font-bold text-slate-500">kWh / Monat</span>
          </div>
          <div className={cn("h-[300px] w-full relative", isPhone && "h-[200px]")}>
            {monthlyData.length === 0 ? (
              <EmptyBox label="Keine Monatsstatistiken in Home Assistant gefunden" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="month" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="solar" name="Solar Ertrag" stackId="a" fill="#32d7ff" />
                  <Bar dataKey="grid" name="Netzbezug" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              Wöchentlicher Produktionsvergleich
            </h2>
            <span className="text-xs font-bold text-slate-500">kWh / Tag</span>
          </div>
          <div className={cn("h-[300px] w-full relative", isPhone && "h-[200px]")}>
            {weeklyData.length === 0 ? (
              <EmptyBox label="Mindestens 14 Tage Solar-Statistik benötigt" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="current"
                    name="Aktuelle Woche"
                    stroke="#32d7ff"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#32d7ff" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    name="Vorherige Woche"
                    stroke="#475569"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: "#475569" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8", isPhone && "gap-4", isTablet && "gap-6")}>
        <div
          className={cn(
            "lg:col-span-2 glass p-8 rounded-[32px] flex flex-col gap-6",
            isPhone && "p-4 rounded-2xl",
            isTablet && "p-6 rounded-3xl"
          )}
        >
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-battery" />
            Kumulativer Ersparnistrend
          </h2>
          <div className={cn("h-[250px] w-full relative", isPhone && "h-[200px]")}>
            {cumulativeSavings.length === 0 ? (
              <EmptyBox label="Keine Monatsdaten für Ersparnisberechnung vorhanden" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeSavings}>
                  <defs>
                    <linearGradient id="trendColorSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="month" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `€${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    name="Ersparnis (€)"
                    fill="url(#trendColorSavings)"
                    stroke="#10B981"
                    strokeWidth={3}
                  />
                </AreaChart>
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
            <Battery className="w-5 h-5 text-solar" />
            Batterienutzung
          </h2>
          <div className="flex flex-col gap-8 flex-1 justify-center">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-slate-500">Zyklusfortschritt</span>
                <span>
                  {state.battery_cycles !== null
                    ? `${Math.round(state.battery_cycles)} / ${config.battery_settings.max_cycles}`
                    : `Ziel: ${config.battery_settings.max_cycles}`}
                </span>
              </div>
              <div className="w-full bg-surface h-3 rounded-full overflow-hidden">
                <div className="bg-solar h-full transition-all duration-500" style={{ width: `${cyclePct}%` }} />
              </div>
              <p className="text-[10px] text-slate-600">
                Kapazität: {config.battery_settings.capacity_kwh || 10} kWh
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface/30 p-4 rounded-2xl border border-border">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  SoC
                </span>
                <span className="text-lg font-bold">{state.battery_soc ?? 0}%</span>
              </div>
              <div className="bg-surface/30 p-4 rounded-2xl border border-border">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Leistung
                </span>
                <span className="text-lg font-bold">{formatPower(state.battery_power)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/20 rounded-2xl border border-dashed border-border gap-3">
      <TrendingUp className="w-8 h-8 text-slate-600" />
      <p className="text-slate-500 text-sm font-medium text-center px-4">{label}</p>
    </div>
  );
}

function TrendCard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  color,
  isPhone,
}: {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: typeof Sun;
  color: string;
  isPhone: boolean;
}) {
  return (
    <div
      className={cn(
        "glass p-6 rounded-3xl flex items-center justify-between group hover:border-solar/30 transition-all duration-300",
        isPhone && "p-4 rounded-2xl"
      )}
    >
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-xs font-bold text-slate-500 uppercase tracking-wider",
            isPhone && "text-[10px]"
          )}
        >
          {title}
        </span>
        <span className={cn("text-2xl font-bold tracking-tight", isPhone && "text-xl")}>
          {value}
        </span>
        <div
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold",
            trendUp ? "text-green-500" : "text-red-500",
            isPhone && "text-[8px]"
          )}
        >
          {trendUp ? (
            <ArrowUpRight className={cn("w-3 h-3", isPhone && "w-2 h-2")} />
          ) : (
            <ArrowDownRight className={cn("w-3 h-3", isPhone && "w-2 h-2")} />
          )}
          {trend}
        </div>
      </div>
      <div
        className={cn(
          "p-4 rounded-2xl bg-surface border border-border group-hover:border-solar/20 transition-colors",
          color,
          isPhone && "p-2"
        )}
      >
        <Icon className={cn("w-6 h-6", isPhone && "w-4 h-4")} />
      </div>
    </div>
  );
}
