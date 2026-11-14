import { useEffect, useRef, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { CameraPopup } from "./components/CameraPopup";
import { CameraView } from "./components/CameraView";
import { DashboardView } from "./components/DashboardView";
import { HeatpumpView } from "./components/HeatpumpView";
import { OverviewView } from "./components/OverviewView";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import { TrendsView } from "./components/TrendsView";
import { useHomeAssistant } from "./hooks/useHomeAssistant";
import { useResponsiveLayout } from "./hooks/useResponsiveLayout";
import { ViewId } from "./types/dashboard";
import { cn } from "./utils/formatters";

export function App() {
  const {
    state,
    config,
    callService,
    updateConfig,
    fetchEntities,
    fetchHistory,
    fetchPeriodStats,
    fetchHeatpumpAnalysis,
  } = useHomeAssistant();
  const [activeView, setActiveView] = useState<ViewId>(
    config.ha_url && config.token ? "dashboard" : "settings"
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const layout = useResponsiveLayout(config.ui_settings.layout_mode);
  const isPhone = layout === "smartphone";

  useEffect(() => {
    audioRef.current = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
    );
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.error);
        wakeLockRef.current = null;
      }
    };
    const onVisibility = async () => {
      if (
        document.visibilityState === "visible" &&
        document.fullscreenElement &&
        "wakeLock" in navigator
      ) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch (err) {
          console.error("WakeLock error:", err);
        }
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("visibilitychange", onVisibility);
      wakeLockRef.current?.release().catch(console.error);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  useEffect(() => {
    if (!state.motion_detected) return;
    setPopupVisible(true);
    if (config.camera_settings.play_sound && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    if (config.camera_settings.popup_duration > 0) {
      popupTimerRef.current = setTimeout(() => {
        setPopupVisible(false);
      }, config.camera_settings.popup_duration * 1000);
    }
  }, [
    state.motion_detected,
    config.camera_settings.popup_duration,
    config.camera_settings.play_sound,
  ]);

  const handleClosePopup = () => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
    setPopupVisible(false);
  };

  const handleToggleDevice = (entityId: string, currentState: string) => {
    const domain = entityId.split(".")[0];
    if (!domain) return;
    callService(domain, currentState === "on" ? "turn_off" : "turn_on", entityId);
  };

  const evEntity =
    config.smart_devices.find((d) => d.id === "ev")?.entity_id || "switch.ev_charger";

  return (
    <div className={cn("flex h-screen overflow-hidden bg-bg", isPhone ? "flex-col" : "flex-row")}>
      {!isPhone && (
        <Sidebar
          devices={config.smart_devices}
          deviceStates={state.device_states}
          onToggle={handleToggleDevice}
          activeView={activeView}
          onViewChange={setActiveView}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
        />
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeView === "dashboard" && (
          <DashboardView
            state={state}
            config={config}
            layout={layout}
            onToggle={handleToggleDevice}
            evChargerEntity={evEntity}
          />
        )}
        {activeView === "overview" && (
          <OverviewView
            state={state}
            config={config}
            layout={layout}
            fetchHistory={fetchHistory}
            fetchPeriodStats={fetchPeriodStats}
          />
        )}
        {activeView === "trends" && (
          <TrendsView state={state} config={config} layout={layout} />
        )}
        {activeView === "heatpump" && (
          <HeatpumpView
            state={state}
            layout={layout}
            fetchHeatpumpAnalysis={fetchHeatpumpAnalysis}
          />
        )}
        {activeView === "camera" && (
          <CameraView state={state} config={config} layout={layout} />
        )}
        {activeView === "settings" && (
          <SettingsView
            state={state}
            config={config}
            layout={layout}
            onSave={updateConfig}
            onFetchEntities={fetchEntities}
          />
        )}
      </div>

      {isPhone && <BottomNav activeView={activeView} onViewChange={setActiveView} />}

      <CameraPopup
        imageUrl={state.camera_image_url}
        webrtcUrl={config.entities.webrtc_url}
        isVisible={popupVisible}
        onClose={handleClosePopup}
      />

      {!state.connected && config.ha_url && (
        <div className="fixed bottom-4 right-4 bg-red-500/20 border border-red-500 text-red-500 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md animate-pulse">
          Verbindung zu Home Assistant unterbrochen
        </div>
      )}
    </div>
  );
}
