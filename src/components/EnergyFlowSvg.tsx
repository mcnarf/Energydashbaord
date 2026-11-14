import { motion } from "framer-motion";
import { Battery, Car, Droplets, Home, Sun, Zap } from "lucide-react";
import { DashboardState } from "../types/dashboard";
import { cn, formatPower, getWaterColor } from "../utils/formatters";

interface FlowLineProps {
  from: [number, number];
  to: [number, number];
  power: number;
  color: string;
}

function FlowLine({ from, to, power, color }: FlowLineProps) {
  const abs = Math.abs(power);
  const active = abs >= 10;
  const forward = power > 0;
  const start = forward ? from : to;
  const end = forward ? to : from;
  const duration = Math.max(0.8, 6 - Math.log10(abs || 1) * 1.2);

  return (
    <g>
      <path
        d={`M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`}
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-slate-400 opacity-30"
      />
      {active && (
        <motion.circle
          r="3"
          fill={color}
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{ duration, repeat: Infinity, ease: "linear" }}
          style={{
            offsetPath: `path('M ${start[0]} ${start[1]} L ${end[0]} ${end[1]}')`,
            filter: `drop-shadow(0 0 5px ${color})`,
          }}
        />
      )}
    </g>
  );
}

interface EnergyFlowSvgProps {
  state: DashboardState;
  waterFlowing: boolean;
  widgetScale: number;
}

export function EnergyFlowSvg({ state, waterFlowing, widgetScale }: EnergyFlowSvgProps) {
  const waterColor = getWaterColor(state.water_temp);

  return (
    <div
      className="w-full aspect-square relative mx-auto transition-all duration-300"
      style={{ maxWidth: `${(widgetScale || 100) * 6.72}px` }}
    >
      <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
        <FlowLine from={[200, 95]} to={[200, 160]} power={state.solar_power} color="#32d7ff" />
        <FlowLine from={[85, 200]} to={[160, 200]} power={state.grid_power} color="#f59e0b" />
        <FlowLine from={[240, 200]} to={[315, 200]} power={state.battery_power} color="#10b981" />
        <FlowLine
          from={[200, 240]}
          to={[135, 305]}
          power={state.ev_charge_power || 0}
          color="#6366f1"
        />
        <FlowLine
          from={[265, 305]}
          to={[200, 240]}
          power={waterFlowing ? 100 : 0}
          color={waterColor.base}
        />

        {/* Haus */}
        <g transform="translate(200, 200)">
          <circle r="40" className="fill-surface stroke-border" />
          <circle
            r="40"
            className={cn(
              "fill-accent/5 stroke-accent/20 transition-opacity duration-500",
              state.home_power > 50 ? "opacity-100" : "opacity-0"
            )}
          />
          <Home className="w-8 h-8 text-slate-400 -translate-x-4 -translate-y-4" />
          <text
            y="55"
            textAnchor="middle"
            className="text-[10px] fill-slate-500 font-bold uppercase tracking-wider"
          >
            Haus
          </text>
          <text y="70" textAnchor="middle" className="text-xs fill-white font-bold">
            {formatPower(state.home_power)}
          </text>
        </g>

        {/* Solar */}
        <g transform="translate(200, 70)">
          <circle r="25" className="fill-surface stroke-border" />
          <circle
            r="25"
            className={cn(
              "fill-solar/10 stroke-solar/30 transition-opacity duration-500",
              state.solar_power > 10 ? "opacity-100" : "opacity-0"
            )}
          />
          <Sun className="w-6 h-6 text-solar -translate-x-3 -translate-y-3" />
          <text
            y="-40"
            textAnchor="middle"
            className="text-[10px] fill-solar font-bold uppercase tracking-wider"
          >
            Solar
          </text>
          <text y="-27" textAnchor="middle" className="text-xs fill-white font-bold">
            {formatPower(state.solar_power)}
          </text>
        </g>

        {/* Netz */}
        <g transform="translate(60, 200)">
          <circle r="25" className="fill-surface stroke-border" />
          <circle
            r="25"
            className={cn(
              "fill-grid/10 stroke-grid/30 transition-opacity duration-500",
              Math.abs(state.grid_power) > 10 ? "opacity-100" : "opacity-0"
            )}
          />
          <Zap className="w-6 h-6 text-grid -translate-x-3 -translate-y-3" />
          <text
            y="-40"
            textAnchor="middle"
            className="text-[10px] fill-grid font-bold uppercase tracking-wider"
          >
            Netz
          </text>
          <text y="-27" textAnchor="middle" className="text-xs fill-white font-bold">
            {formatPower(state.grid_power)}
          </text>
        </g>

        {/* Batterie */}
        <g transform="translate(340, 200)">
          <circle r="25" className="fill-surface stroke-border" />
          <circle
            r="25"
            className={cn(
              "fill-battery/10 stroke-battery/30 transition-opacity duration-500",
              Math.abs(state.battery_power) > 10 ? "opacity-100" : "opacity-0"
            )}
          />
          <Battery className="w-6 h-6 text-battery -translate-x-3 -translate-y-3" />
          <text
            y="-40"
            textAnchor="middle"
            className="text-[10px] fill-battery font-bold uppercase tracking-wider"
          >
            Batterie
          </text>
          <text y="-27" textAnchor="middle" className="text-xs fill-white font-bold">
            {formatPower(state.battery_power)}
          </text>
        </g>

        {/* E-Auto */}
        <g transform="translate(135, 330)">
          <circle r="25" className="fill-surface stroke-border" />
          <circle
            r="25"
            className={cn(
              "fill-accent/10 stroke-accent/30 transition-opacity duration-500",
              (state.ev_charge_power || 0) > 10 ? "opacity-100" : "opacity-0"
            )}
          />
          <Car className="w-6 h-6 text-accent -translate-x-3 -translate-y-3" />
          <text
            y="40"
            textAnchor="middle"
            className="text-[10px] fill-accent font-bold uppercase tracking-wider"
          >
            E-Auto
          </text>
          <text y="53" textAnchor="middle" className="text-xs fill-white font-bold">
            {formatPower(state.ev_charge_power || 0)}
          </text>
        </g>

        {/* Wasser */}
        <g transform="translate(265, 330)">
          <circle r="25" className="fill-surface stroke-border" />
          <circle
            r="25"
            className={cn(
              "transition-opacity duration-500",
              (state.water_today || 0) > 0 ? "opacity-100" : "opacity-0"
            )}
            style={{ fill: waterColor.light, stroke: waterColor.medium }}
          />
          <Droplets
            className="w-6 h-6 -translate-x-3 -translate-y-3"
            style={{ color: waterColor.base }}
          />
          <text
            y="40"
            textAnchor="middle"
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ fill: waterColor.base }}
          >
            Wasser
          </text>
          <text y="53" textAnchor="middle" className="text-[10px] fill-white font-bold">
            {state.water_today ?? 0} L | {state.water_temp ?? 0} °C
          </text>
          <text y="65" textAnchor="middle" className="text-[9px] fill-slate-500">
            {state.water_meter ?? 0} m³
          </text>
        </g>
      </svg>
    </div>
  );
}
