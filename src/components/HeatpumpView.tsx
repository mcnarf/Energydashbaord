import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  RefreshCw,
  Thermometer,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardState } from "../types/dashboard";
import { cn } from "../utils/formatters";

interface HeatpumpViewProps {
  state: DashboardState;
  layout: "pc" | "tablet" | "smartphone";
  fetchHeatpumpAnalysis: (hours?: number) => Promise<void>;
}

const BASELINE = {
  cyclesPerDay: 45,
  avgHeatMin: 6.3,
  avgStandbyMin: 24.4,
  spreadRange: "0,5–1,7 K",
  roomAvg: 23.84,
  outsideAvg: 5.27,
  otPer48h: 2,
};

export function HeatpumpView({ state, layout, fetchHeatpumpAnalysis }: HeatpumpViewProps) {
  const [hours, setHours] = useState<24 | 48>(24);
  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";
  const hp = state.heatpump;

  useEffect(() => {
    if (state.connected) {
      fetchHeatpumpAnalysis(hours);
    }
  }, [state.connected, hours, fetchHeatpumpAnalysis]);

  const cyclesPer24h = hours === 48 ? Math.round((hp.heatCycles / 2) * 10) / 10 : hp.heatCycles;

  const improvedCycles = hp.heatCycles > 0 && cyclesPer24h < BASELINE.cyclesPerDay * 0.85;
  const improvedRuntime = hp.avgHeatMinutes > BASELINE.avgHeatMin * 1.25;
  const improvedSpread = hp.avgSpreadK !== null && hp.avgSpreadK >= 1.8;

  const evalScore = [improvedCycles, improvedRuntime, improvedSpread].filter(Boolean).length;
  const evalLabel =
    hp.heatCycles === 0 && hp.tempSeries.length === 0
      ? "Warte auf Daten..."
      : evalScore >= 2
      ? "Deutliche Besserung vs. Baseline"
      : evalScore === 1
      ? "Leichte Besserung vs. Baseline"
      : "Keine Besserung vs. Baseline";

  const statusColor =
    state.hp_live_status === "heat"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
      : state.hp_live_status === "otshutdown"
      ? "bg-red-500/20 text-red-400 border-red-500/40"
      : "bg-surface text-slate-400 border-border";

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
          "flex items-center justify-between flex-wrap gap-4",
          isPhone && "flex-col items-start"
        )}
      >
        <div className="flex flex-col gap-1.5">
          <h1 className={cn("text-3xl font-bold flex items-center gap-3", isPhone && "text-2xl")}>
            <Flame className="w-8 h-8 text-orange-400" />
            Wärmepumpe (ebusd)
          </h1>
          <p className="text-slate-500 text-sm">
            Takt- & Temperaturanalyse der letzten {hours} Stunden im Vergleich zur Baseline
            (13.11.2026).
          </p>
        </div>

        <div className={cn("flex items-center gap-3 flex-wrap", isPhone && "w-full justify-between")}>
          <div className={cn("px-3.5 py-2 rounded-full text-xs font-bold border", statusColor)}>
            Status: {state.hp_live_status ?? "unbekannt"}
          </div>

          <div className="flex bg-surface p-1 rounded-xl border border-border">
            {([24, 48] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  hours === h ? "bg-solar text-bg" : "text-slate-400 hover:text-white"
                )}
              >
                {h}h
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchHeatpumpAnalysis(hours)}
            disabled={hp.loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold hover:border-solar transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4", hp.loading && "animate-spin text-solar")} />
            {hp.loading ? "Analysiere..." : "Aktualisieren"}
          </button>
        </div>
      </header>

      {/* Baseline Comparison Banner */}
      <div className="glass p-5 rounded-3xl flex items-center justify-between flex-wrap gap-4 border-solar/20">
        <div className="flex items-center gap-3">
          {evalScore >= 1 ? (
            <CheckCircle2 className="w-6 h-6 text-battery shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-grid shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold">{evalLabel}</span>
            <span className="text-xs text-slate-400">
              Baseline (13.11.2026): ~{BASELINE.cyclesPerDay} Takte/Tag • Ø {BASELINE.avgHeatMin}{" "}
              Min Laufzeit • Ø {BASELINE.avgStandbyMin} Min Standby • {BASELINE.spreadRange}{" "}
              Spreizung • Ø {BASELINE.outsideAvg} °C Außen
            </span>
          </div>
        </div>
        {hp.lastAnalyzed && (
          <span className="text-[11px] text-slate-500">
            Stand: {new Date(hp.lastAnalyzed).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Live Values Row */}
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-4 gap-4",
          isPhone && "grid-cols-2 gap-3"
        )}
      >
        <HpCard
          label="Vorlauf (Live)"
          value={state.hp_live_flow !== null ? `${state.hp_live_flow.toFixed(1)} °C` : "—"}
          sub={`Ø Spreizung: ${hp.avgSpreadK !== null ? `${hp.avgSpreadK} K` : "—"}`}
          color="text-orange-400"
        />
        <HpCard
          label="Rücklauf (Live)"
          value={state.hp_live_return !== null ? `${state.hp_live_return.toFixed(1)} °C` : "—"}
          sub={
            state.hp_live_flow !== null && state.hp_live_return !== null
              ? `Akt. ΔT: ${(state.hp_live_flow - state.hp_live_return).toFixed(2)} K`
              : "—"
          }
          color="text-solar"
        />
        <HpCard
          label="Außentemperatur"
          value={state.hp_live_outside !== null ? `${state.hp_live_outside.toFixed(1)} °C` : "—"}
          sub={
            hp.outsideAvg !== null
              ? `Ø ${hp.outsideAvg}° (${hp.outsideMin ?? "?"}..${hp.outsideMax ?? "?"}°)`
              : "Keine Statistik"
          }
          color="text-blue-400"
        />
        <HpCard
          label="Wohnzimmer"
          value={state.hp_live_room !== null ? `${state.hp_live_room.toFixed(1)} °C` : "—"}
          sub={`Ø ${hours}h: ${hp.roomAvg !== null ? `${hp.roomAvg} °C` : "—"}`}
          color="text-battery"
        />
      </div>

      {/* 24h/48h Cycle & Counter KPIs */}
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4",
          isPhone && "grid-cols-2 gap-3"
        )}
      >
        <HpCard
          label={`Heiztakte (${hours}h)`}
          value={`${hp.heatCycles}`}
          sub={`Pro 24h: ~${cyclesPer24h} (Base: ${BASELINE.cyclesPerDay})`}
          color={improvedCycles ? "text-battery" : "text-solar"}
        />
        <HpCard
          label="Ø Taktlaufzeit"
          value={`${hp.avgHeatMinutes} Min`}
          sub={`Baseline: ${BASELINE.avgHeatMin} Min`}
          color={improvedRuntime ? "text-battery" : "text-white"}
        />
        <HpCard
          label="Ø Standby-Pause"
          value={`${hp.avgStandbyMinutes} Min`}
          sub={`Baseline: ${BASELINE.avgStandbyMin} Min`}
          color="text-slate-300"
        />
        <HpCard
          label="otshutdown"
          value={`${hp.otShutdownCount}`}
          sub={`Baseline: ${BASELINE.otPer48h} / 48h`}
          color={hp.otShutdownCount > 0 ? "text-red-400" : "text-battery"}
        />
        <HpCard
          label="Verdichterstarts"
          value={hp.compStartsDelta !== null ? `+${hp.compStartsDelta}` : "—"}
          sub={
            hp.compHoursDelta !== null
              ? `Laufzeit: +${hp.compHoursDelta} h | Heizstab: +${hp.backupHoursDelta ?? 0} h`
              : "Zähler-Differenz"
          }
          color="text-accent"
        />
        <HpCard
          label="Sole Ø (Ein / Aus)"
          value={
            hp.sourceInAvg !== null && hp.sourceOutAvg !== null
              ? `${hp.sourceInAvg}° / ${hp.sourceOutAvg}°`
              : "—"
          }
          sub={hp.sourceSpreadK !== null ? `Sole-ΔT: ${hp.sourceSpreadK} K` : "Keine Statistik"}
          color="text-cyan-400"
        />
      </div>

      {/* Charts */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-8", isPhone && "gap-4")}>
        <div className={cn("glass p-8 rounded-[32px] flex flex-col gap-6", isPhone && "p-4 rounded-2xl")}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-400" />
            Heizkreis & Temperaturen ({hours}h)
          </h2>
          <div className={cn("h-[300px] w-full relative", isPhone && "h-[220px]")}>
            {hp.tempSeries.length === 0 ? (
              <EmptyState label="Keine Temperaturstatistiken gefunden" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hp.tempSeries}>
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
                    tickFormatter={(v) => `${v}°C`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="flow" name="Vorlauf" stroke="#FB923C" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="returnTemp" name="Rücklauf" stroke="#32d7ff" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="room" name="Wohnzimmer" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="outside" name="Außen" stroke="#64748B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cn("glass p-8 rounded-[32px] flex flex-col gap-6", isPhone && "p-4 rounded-2xl")}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-solar" />
            Sole-Temperaturen & Spreizung ({hours}h)
          </h2>
          <div className={cn("h-[300px] w-full relative", isPhone && "h-[220px]")}>
            {hp.tempSeries.length === 0 ? (
              <EmptyState label="Keine Sole-/Spreizungsdaten gefunden" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hp.tempSeries}>
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
                    tickFormatter={(v) => `${v}°`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      border: "1px solid #1E293B",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="sourceIn" name="Sole Eingang (°C)" stroke="#38BDF8" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="sourceOut" name="Sole Ausgang (°C)" stroke="#818CF8" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="spread" name="Spreizung Vor/Rück (K)" stroke="#FBBF24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Cycles */}
      <div className={cn("glass p-8 rounded-[32px] flex flex-col gap-4", isPhone && "p-4 rounded-2xl")}>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          Letzte Betriebsphasen
        </h2>
        {hp.recentCycles.length === 0 ? (
          <p className="text-sm text-slate-500">Noch keine Status-Wechsel im gewählten Zeitraum erfasst.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {hp.recentCycles.slice(0, 12).map((seg, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-surface/40 rounded-2xl border border-border text-xs"
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "font-bold uppercase",
                      seg.status === "heat"
                        ? "text-orange-400"
                        : seg.status === "otshutdown"
                        ? "text-red-400"
                        : "text-slate-300"
                    )}
                  >
                    {seg.status}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(seg.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(seg.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <span className="font-bold text-slate-200">{seg.durationMin} Min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HpCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="glass p-5 rounded-3xl flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-2xl font-bold tracking-tight", color)}>{value}</span>
      <span className="text-[11px] text-slate-400 truncate" title={sub}>
        {sub}
      </span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/20 rounded-2xl border border-dashed border-border gap-2">
      <TrendingUp className="w-7 h-7 text-slate-600" />
      <p className="text-slate-500 text-sm">{label}</p>
    </div>
  );
}
