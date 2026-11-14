import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import { cn } from "../utils/formatters";

interface CameraPopupProps {
  imageUrl: string | null;
  webrtcUrl: string;
  isVisible: boolean;
  onClose: () => void;
}

export function CameraPopup({ imageUrl, webrtcUrl, isVisible, onClose }: CameraPopupProps) {
  const [expanded, setExpanded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<"webrtc" | "snapshot">("webrtc");

  useEffect(() => {
    if (isVisible) {
      setMode(webrtcUrl ? "webrtc" : "snapshot");
    }
  }, [isVisible, webrtcUrl]);

  if (!isVisible || (!imageUrl && !webrtcUrl)) return null;
  const showWebrtc = mode === "webrtc" && webrtcUrl.trim() !== "";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={cn(
          "fixed z-50 glass rounded-3xl overflow-hidden shadow-2xl transition-all duration-500",
          expanded
            ? "inset-4 md:inset-10"
            : "bottom-8 right-8 w-[95vw] md:w-[720px] lg:w-[960px] aspect-video max-w-[95vw]"
        )}
      >
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white">
              Bewegung erkannt
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {webrtcUrl && imageUrl && (
              <div className="flex bg-white/10 p-0.5 rounded-lg mr-1">
                <button
                  onClick={() => setMode("webrtc")}
                  className={cn(
                    "px-2 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer",
                    mode === "webrtc" ? "bg-solar text-bg" : "text-white/50"
                  )}
                >
                  RTC
                </button>
                <button
                  onClick={() => setMode("snapshot")}
                  className={cn(
                    "px-2 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer",
                    mode === "snapshot" ? "bg-solar text-bg" : "text-white/50"
                  )}
                >
                  IMG
                </button>
              </div>
            )}
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
              title="Neu laden"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hidden md:block cursor-pointer"
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="w-full h-full bg-black flex items-center justify-center">
          {showWebrtc ? (
            <iframe
              key={reloadKey}
              src={
                webrtcUrl.includes("?")
                  ? `${webrtcUrl}&autoplay=1&muted=1`
                  : `${webrtcUrl}?autoplay=1&muted=1`
              }
              title="WebRTC Kamera Stream"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; picture-in-picture; camera; microphone"
              allowFullScreen
            />
          ) : (
            <img
              src={imageUrl || ""}
              alt="Kamera Stream"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
            <div className="flex items-center gap-2 text-white/60 text-[9px] font-medium uppercase tracking-widest">
              <Camera className="w-3 h-3" />
              <span>Haustür</span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
