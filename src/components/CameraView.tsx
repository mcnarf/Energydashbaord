import { useState } from "react";
import { Camera, ExternalLink, HelpCircle, RefreshCw, RotateCw } from "lucide-react";
import { DashboardConfig, DashboardState } from "../types/dashboard";
import { cn } from "../utils/formatters";

interface CameraViewProps {
  state: DashboardState;
  config: DashboardConfig;
  layout: "pc" | "tablet" | "smartphone";
}

export function CameraView({ state, config, layout }: CameraViewProps) {
  const [mode, setMode] = useState<"webrtc" | "snapshot">("webrtc");
  const [reloadKey, setReloadKey] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";
  const webrtcUrl = config.entities.webrtc_url?.trim() || "";
  const hasWebrtc = mode === "webrtc" && webrtcUrl !== "";

  return (
    <div
      className={cn(
        "flex-1 p-12 flex flex-col gap-8 overflow-y-auto",
        isPhone && "p-4 gap-4",
        isTablet && "p-8 gap-6"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between max-w-6xl",
          isPhone && "flex-col gap-4 items-start"
        )}
      >
        <h1 className={cn("text-3xl font-bold flex items-center gap-4", isPhone && "text-2xl gap-2")}>
          <Camera className={cn("w-8 h-8 text-solar", isPhone && "w-6 h-6")} />
          Live Kamera
        </h1>

        <div className={cn("flex items-center gap-4", isPhone && "w-full justify-between flex-wrap")}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-2 bg-surface border border-border rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Stream neu laden"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.location.reload()}
              className="p-2 bg-surface border border-border rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Anwendung neu laden"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowHelp((s) => !s)}
              className={cn(
                "p-2 rounded-full transition-colors cursor-pointer",
                showHelp
                  ? "bg-solar text-bg"
                  : "bg-surface border border-border text-slate-400 hover:text-white"
              )}
              title="Hilfe & Fehlerbehebung"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="flex bg-surface p-1 rounded-xl border border-border">
            <button
              onClick={() => setMode("webrtc")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                mode === "webrtc" ? "bg-solar text-bg shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              WebRTC
            </button>
            <button
              onClick={() => setMode("snapshot")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                mode === "snapshot"
                  ? "bg-solar text-bg shadow-lg"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              Snapshot
            </button>
          </div>

          <div
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all duration-500",
              state.motion_detected
                ? "bg-red-500/20 text-red-500 border border-red-500 animate-pulse"
                : "bg-surface text-slate-500 border border-border",
              isPhone && "w-full justify-center"
            )}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                state.motion_detected ? "bg-red-500" : "bg-slate-700"
              )}
            />
            {state.motion_detected ? "BEWEGUNG ERKANNT" : "KEINE BEWEGUNG"}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "glass rounded-[40px] overflow-hidden aspect-video max-w-6xl relative group bg-black",
          isPhone && "rounded-2xl"
        )}
      >
        {hasWebrtc ? (
          <div className="w-full h-full relative">
            <iframe
              key={reloadKey}
              src={webrtcUrl}
              title="WebRTC Kamera Stream"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture; camera; microphone; display-capture; clipboard-write; encrypted-media; gyroscope; accelerometer"
              allowFullScreen
            />
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button
                onClick={() => window.open(webrtcUrl, "_blank")}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white/70 hover:text-white transition-all backdrop-blur-md cursor-pointer"
                title="Stream in neuem Tab öffnen"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white/70 hover:text-white transition-all backdrop-blur-md cursor-pointer"
                title="Stream neu laden"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : state.camera_image_url ? (
          <img
            key={state.camera_image_url}
            src={state.camera_image_url}
            alt="Live Stream"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-surface/50">
            <Camera className="w-12 h-12 text-slate-700" />
            <p className="text-slate-500 font-medium">
              Keine Kamera-Entität oder WebRTC-URL konfiguriert
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
          <div className="flex flex-col">
            <span className="text-white font-bold text-lg">Haustür Kamera</span>
            <span className="text-white/60 text-sm">
              {mode === "webrtc" ? "WebRTC Stream" : "Snapshot Modus"} •{" "}
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="max-w-6xl flex flex-col gap-4 p-6 glass rounded-3xl border-solar/20">
          <h3 className="text-sm font-bold text-solar uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Fehlerbehebung
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-400">
            <div className="flex flex-col gap-2">
              <p className="font-bold text-slate-300">WebRTC Stream lädt nicht?</p>
              <ul className="list-disc list-inside flex flex-col gap-1">
                <li>Stellen Sie sicher, dass die URL von Ihrem Netzwerk aus erreichbar ist.</li>
                <li>Prüfen Sie Mixed Content (HTTP-Stream auf HTTPS-Seite).</li>
                <li>go2rtc sollte Einbetten erlauben (kein blockierender X-Frame-Options Header).</li>
                <li>
                  Nutzen Sie für go2rtc bevorzugt <code>webrtc.html</code> oder{" "}
                  <code>stream.html</code>.
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-bold text-slate-300">Snapshot lädt nicht?</p>
              <ul className="list-disc list-inside flex flex-col gap-1">
                <li>Überprüfen Sie Home Assistant URL und Token in den Einstellungen.</li>
                <li>Stellen Sie sicher, dass die Kamera-Entitäts-ID korrekt ist.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
