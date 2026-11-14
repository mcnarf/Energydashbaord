import { DashboardConfig } from "../types/dashboard";

const STORAGE_KEY = "ha_dashboard_config";

export const DEFAULT_CONFIG: DashboardConfig = {
  ha_url: "",
  token: "",
  entities: {
    solar_power: "sensor.solar_power",
    grid_power: "sensor.grid_power",
    home_power: "sensor.home_power",
    battery_power: "sensor.battery_power",
    battery_soc: "sensor.battery_soc",
    battery_cycles: "",
    battery_discharge_today: "",
    solar_today: "sensor.solar_today",
    solar_forecast_today: "sensor.solcast_pv_forecast_prognose_heute",
    solar_forecast_tomorrow: "sensor.solcast_pv_forecast_prognose_morgen",
    grid_import_today: "sensor.grid_import_today",
    grid_export_today: "sensor.grid_export_today",
    ev_range: "",
    ev_soc: "",
    ev_charge_power: "",
    camera_entity: "camera.front_door",
    motion_sensor_entity: "binary_sensor.front_door_motion",
    webrtc_url: "",
    water_meter: "",
    water_today: "",
    water_temp: "",
    top_consumers: [],
    hp_status: "sensor.ebusd_ehp_heatpumpstatus",
    hp_comp_starts: "sensor.ebusd_ehp_compstarts",
    hp_comp_hours: "sensor.ebusd_ehp_comphours",
    hp_backup_hours: "sensor.ebusd_ehp_backuphours",
    hp_flow_temp: "sensor.ebusd_ehp_hcflowtemp_temp",
    hp_return_temp: "sensor.ebusd_ehp_hcreturntemp_temp",
    hp_outside_temp: "sensor.ebusd_ehp_outsidetemp_temp",
    hp_source_in_temp: "sensor.ebusd_ehp_sourcetempinput_temp",
    hp_source_out_temp: "sensor.ebusd_ehp_sourcetempoutput_temp",
    hp_room_temp: "sensor.temperatur_wohnzimmer_temperature_2",
  },
  economic_settings: {
    energy_price_mode: "fixed",
    energy_price: 0.35,
    energy_price_entity: null,
    feed_in_tariff: 0.08,
    co2_factor: 0.4,
    pv_investment_cost: 0,
    pv_installation_date: "",
    pv_previous_savings: 0,
    battery_investment_cost: 0,
    battery_installation_date: "",
    battery_previous_savings: 0,
  },
  battery_settings: {
    capacity_kwh: 10,
    max_cycles: 6000,
  },
  camera_settings: {
    popup_duration: 30,
    play_sound: true,
  },
  ui_settings: {
    zoom_level: 100,
    layout_mode: "auto",
    widget_scale: 100,
  },
  smart_devices: [
    { id: "ac", name: "Wohnzimmer Klima", entity_id: "switch.living_room_ac", type: "switch" },
    { id: "ev", name: "E-Auto Ladestation", entity_id: "switch.ev_charger", type: "switch" },
    { id: "lights", name: "Smarte Lichter", entity_id: "light.living_room_lights", type: "light" },
  ],
};

export function mergeConfig(partial: Partial<DashboardConfig>): DashboardConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    entities: {
      ...DEFAULT_CONFIG.entities,
      ...(partial.entities ?? {}),
    },
    economic_settings: {
      ...DEFAULT_CONFIG.economic_settings,
      ...(partial.economic_settings ?? {}),
    },
    battery_settings: {
      ...DEFAULT_CONFIG.battery_settings,
      ...(partial.battery_settings ?? {}),
    },
    camera_settings: {
      ...DEFAULT_CONFIG.camera_settings,
      ...(partial.camera_settings ?? {}),
    },
    ui_settings: {
      ...DEFAULT_CONFIG.ui_settings,
      ...(partial.ui_settings ?? {}),
      widget_scale: partial.ui_settings?.widget_scale ?? DEFAULT_CONFIG.ui_settings.widget_scale,
    },
    smart_devices: Array.isArray(partial.smart_devices)
      ? partial.smart_devices
      : DEFAULT_CONFIG.smart_devices,
  };
}

export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return mergeConfig(JSON.parse(raw) as Partial<DashboardConfig>);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: DashboardConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
