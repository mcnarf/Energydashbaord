export interface HourlyBucket {
  time: string;
  solar: number;
  consumption: number;
  battery: number;
}

/**
 * Physical power balance at the home bus:
 * solar + grid - battery = home_consumption
 * (grid > 0 = import, grid < 0 = export; battery > 0 = charging, battery < 0 = discharging)
 */
export function computeHomePower(solar: number, grid: number, battery: number): number {
  return Math.max(0, solar + grid - battery);
}

/**
 * Computes net grid power (W) from consumption, solar, and battery power.
 * Positive = grid import, negative = grid export.
 */
export function computeGridPower(consumption: number, solar: number, battery: number): number {
  return consumption - solar + battery;
}

export function computeAutarkyPercent(hourly: HourlyBucket[]): number {
  if (hourly.length === 0) return 0;
  let totalConsumption = 0;
  let totalGridImport = 0;

  for (const h of hourly) {
    const gridNet = computeGridPower(h.consumption, h.solar, h.battery);
    totalConsumption += h.consumption;
    totalGridImport += Math.max(0, gridNet);
  }

  if (totalConsumption <= 0) return 0;
  const autarky = ((totalConsumption - totalGridImport) / totalConsumption) * 100;
  return Math.min(100, Math.max(0, Math.round(autarky)));
}

export function computeDailySavings(
  hourly: HourlyBucket[],
  energyPrice: number,
  feedInTariff: number
): number {
  if (hourly.length === 0) return 0;
  let selfConsumedKwh = 0;
  let exportedKwh = 0;

  for (const h of hourly) {
    const gridNet = computeGridPower(h.consumption, h.solar, h.battery);
    const gridExportW = gridNet < 0 ? Math.abs(gridNet) : 0;
    const solarSelfConsumedW = Math.max(0, h.solar - gridExportW);
    selfConsumedKwh += solarSelfConsumedW / 1000;
    exportedKwh += gridExportW / 1000;
  }

  return selfConsumedKwh * energyPrice + exportedKwh * feedInTariff;
}

export function computeNetGridKwh(hourly: HourlyBucket[]): number {
  let importKwh = 0;
  let exportKwh = 0;
  for (const h of hourly) {
    const gridNet = computeGridPower(h.consumption, h.solar, h.battery);
    if (gridNet > 0) importKwh += gridNet / 1000;
    else exportKwh += Math.abs(gridNet) / 1000;
  }
  return importKwh - exportKwh;
}

export function estimateBatteryRuntimeHours(
  soc: number | null,
  batteryPowerW: number,
  capacityKwh: number
): string | null {
  if (soc === null || capacityKwh <= 0) return null;
  // Discharging: batteryPowerW < -50
  if (batteryPowerW < -50) {
    const remainingKwh = (soc / 100) * capacityKwh;
    const hours = remainingKwh / (Math.abs(batteryPowerW) / 1000);
    if (!Number.isFinite(hours) || hours > 99) return null;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `Restlaufzeit ~${h}h ${m}m`;
  }
  // Charging: batteryPowerW > 50
  if (batteryPowerW > 50 && soc < 100) {
    const missingKwh = ((100 - soc) / 100) * capacityKwh;
    const hours = missingKwh / (batteryPowerW / 1000);
    if (!Number.isFinite(hours) || hours > 99) return null;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `Voll in ~${h}h ${m}m`;
  }
  return null;
}
