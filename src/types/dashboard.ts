export type ViewId = "dashboard" | "overview" | "trends" | "camera" | "settings";

export type LayoutMode = "auto" | "pc" | "tablet" | "smartphone";

export type DeviceType = "switch" | "light" | "climate";

export interface SmartDevice {
  id: string;
  name: string;
  entity_id: string;
  type: DeviceType;
}

export interface EntityConfig {
  solar_power: string;
  grid_power: string;
  home_power: string;
  battery_power: string;
  battery_soc: string;
  battery_cycles: string;
  solar_today: string;
  solar_forecast_today: string;
  solar_forecast_tomorrow: string;
  grid_import_today: string;
  grid_export_today: string;
  ev_range: string;
  ev_soc: string;
  ev_charge_power: string;
  camera_entity: string;
  motion_sensor_entity: string;
  webrtc_url: string;
  water_meter: string;
  water_today: string;
  water_temp: string;
  top_consumers: string[];
}

export interface EconomicSettings {
  energy_price_mode: "fixed" | "entity";
  energy_price: number;
  energy_price_entity: string | null;
  feed_in_tariff: number;
  co2_factor: number;
}

export interface BatterySettings {
  capacity_kwh: number;
  max_cycles: number;
}

export interface CameraSettings {
  popup_duration: number;
  play_sound: boolean;
}

export interface UiSettings {
  zoom_level: number;
  layout_mode: LayoutMode;
  widget_scale: number;
}

export interface DashboardConfig {
  ha_url: string;
  token: string;
  entities: EntityConfig;
  economic_settings: EconomicSettings;
  battery_settings: BatterySettings;
  camera_settings: CameraSettings;
  ui_settings: UiSettings;
  smart_devices: SmartDevice[];
}

export interface EntityOption {
  entity_id: string;
  friendly_name: string;
  unit?: string;
}

export interface HistoryPoint {
  time: string | number;
  value: number;
}

export interface MonthlyStat {
  month: string;
  solar: number;
  grid: number;
  battery: number;
  export: number;
}

export interface WeeklyStat {
  day: string;
  current: number;
  previous: number;
}

export interface DashboardState {
  solar_power: number;
  grid_power: number;
  home_power: number;
  battery_power: number;
  battery_soc: number | null;
  battery_cycles: number | null;
  solar_today: number | null;
  solar_forecast_today: number | null;
  solar_forecast_tomorrow: number | null;
  grid_import_today: number | null;
  grid_export_today: number | null;
  ev_range: number | null;
  ev_soc: number | null;
  ev_charge_power: number | null;
  water_meter: number | null;
  water_today: number | null;
  water_temp: number | null;
  current_energy_price: number | null;
  camera_image_url: string | null;
  motion_detected: boolean;
  connected: boolean;
  lastUpdated: number | null;
  availableEntities: EntityOption[];
  isFetchingEntities: boolean;
  entityError: string | null;
  device_states: Record<string, string>;
  history: {
    solar: HistoryPoint[];
    consumption: HistoryPoint[];
    battery: HistoryPoint[];
    water: HistoryPoint[];
  };
  statistics: {
    monthly: MonthlyStat[];
    weekly: WeeklyStat[];
  };
}
