import { useEffect, useState } from "react";
import { LayoutMode } from "../types/dashboard";

export function useResponsiveLayout(mode: LayoutMode): "pc" | "tablet" | "smartphone" {
  const [detected, setDetected] = useState<"pc" | "tablet" | "smartphone">(() => {
    if (typeof window === "undefined") return "pc";
    if (window.innerWidth < 640) return "smartphone";
    if (window.innerWidth < 1024) return "tablet";
    return "pc";
  });

  useEffect(() => {
    if (mode !== "auto") return;
    const update = () => {
      if (window.innerWidth < 640) setDetected("smartphone");
      else if (window.innerWidth < 1024) setDetected("tablet");
      else setDetected("pc");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mode]);

  return mode === "auto" ? detected : mode;
}
