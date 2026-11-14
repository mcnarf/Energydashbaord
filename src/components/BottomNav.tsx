import { Activity, Camera, Flame, LayoutDashboard, Settings, Zap } from "lucide-react";
import { ViewId } from "../types/dashboard";
import { cn } from "../utils/formatters";

interface BottomNavProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

const ITEMS: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dash", icon: LayoutDashboard },
  { id: "overview", label: "Übersicht", icon: Activity },
  { id: "trends", label: "Trends", icon: Zap },
  { id: "heatpump", label: "WP", icon: Flame },
  { id: "camera", label: "Kamera", icon: Camera },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  return (
    <nav className="h-16 bg-surface border-t border-border flex items-center justify-around px-2 shrink-0 z-50">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 cursor-pointer",
              active ? "text-solar" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Icon className={cn("w-5 h-5", active && "fill-solar/20")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            {active && <div className="absolute -bottom-0.5 w-1 h-1 bg-solar rounded-full" />}
          </button>
        );
      })}
    </nav>
  );
}
