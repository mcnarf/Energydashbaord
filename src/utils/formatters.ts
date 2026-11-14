export function formatPower(watts: number): string {
  const abs = Math.abs(watts);
  return abs < 1000 ? `${Math.round(abs)} W` : `${(abs / 1000).toFixed(1)} kW`;
}

export function getWaterColor(temp: number | null): {
  base: string;
  light: string;
  medium: string;
} {
  if (temp === null) {
    return {
      base: "#60a5fa",
      light: "rgba(96, 165, 250, 0.1)",
      medium: "rgba(96, 165, 250, 0.3)",
    };
  }
  const ratio = (Math.min(Math.max(temp, 20), 50) - 20) / 30;
  const r = Math.round(96 + 152 * ratio);
  const g = Math.round(165 - 52 * ratio);
  const b = Math.round(250 - 137 * ratio);
  return {
    base: `rgb(${r}, ${g}, ${b})`,
    light: `rgba(${r}, ${g}, ${b}, 0.1)`,
    medium: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
