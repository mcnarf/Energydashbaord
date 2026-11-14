import { motion } from "framer-motion";
import {
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Power,
  Settings,
  Zap,
} from "lucide-react";
import { SmartDevice, ViewId } from "../types/dashboard";
import { cn } from "../utils/formatters";

interface SidebarProps {
  devices: SmartDevice[];
  deviceStates: Record<string, string>;
  onToggle: (entityId: string, currentState: string) => void;
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "overview", label: "Übersicht", icon: Activity },
  { id: "trends", label: "Energie Trends", icon: Zap },
  { id: "heatpump", label: "Wärmepumpe", icon: Flame },
  { id: "camera", label: "Kamera", icon: Camera },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

export function Sidebar({
  devices,
  deviceStates,
  onToggle,
  activeView,
  onViewChange,
  isOpen,
  setIsOpen,
  isFullscreen,
  toggleFullscreen,
}: SidebarProps) {
  return (
    <motion.aside
      initial={isOpen ? "open" : "closed"}
      animate={isOpen ? "open" : "closed"}
      variants={{ open: { width: "256px" }, closed: { width: "80px" } }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-screen bg-bg border-r border-border flex flex-col p-6 gap-6 shrink-0 relative z-40"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Sidebar schließen" : "Sidebar öffnen"}
        className="absolute -right-3 top-10 w-6 h-6 bg-solar rounded-full flex items-center justify-center text-bg shadow-lg hover:scale-110 transition-transform z-50 cursor-pointer"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className={cn("flex items-center gap-2 px-2", !isOpen && "justify-center px-0")}>
        <div className="w-8 h-8 bg-battery rounded-lg flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-bg fill-current" />
        </div>
        {isOpen && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-xl tracking-tight"
          >
            Voltix
          </motion.span>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={isOpen ? undefined : item.label}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group w-full text-left cursor-pointer",
                active
                  ? "bg-surface text-white glow-solar"
                  : "text-slate-500 hover:text-slate-300 hover:bg-surface/50",
                !isOpen && "justify-center px-0"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  active ? "text-solar" : "text-slate-500 group-hover:text-slate-300"
                )}
              />
              {isOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {isOpen && devices.length > 0 && (
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pt-4 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2">
            Smart Geräte
          </span>
          {devices.map((dev) => {
            const stateStr = deviceStates[dev.entity_id] || "off";
            const isOn = stateStr === "on";
            return (
              <button
                key={dev.id}
                onClick={() => onToggle(dev.entity_id, stateStr)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                  isOn
                    ? "bg-battery/10 border-battery/30 text-white"
                    : "bg-surface/40 border-border text-slate-400 hover:text-white"
                )}
              >
                <span className="truncate">{dev.name}</span>
                <Power className={cn("w-4 h-4 shrink-0", isOn ? "text-battery" : "text-slate-600")} />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-border">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface/60 transition-all w-full cursor-pointer",
            !isOpen && "justify-center px-0"
          )}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {isOpen && (
            <span className="text-xs font-medium">
              {isFullscreen ? "Vollbild beenden" : "Vollbild"}
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
