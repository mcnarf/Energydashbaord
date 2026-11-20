export type ViewId = "dashboard" | "overview" | "trends" | "heatpump" | "camera" | "settings";

export type OverviewPeriod = "day" | "month" | "quarter" | "year";

export interface PeriodBucket {
  label: string;
  solarKwh: number;
  consumptionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  batteryKwh: number;
  waterL: number;
}

export type LayoutMode = "auto" | "pc" | "tablet" | "smartphone";

export type DeviceType = "switch" | "light" | "climate";

export type CustomFlowIcon =
  | "sun"
  | "zap"
  | "flame"
  | "plug"
  | "battery"
  | "car"
  | "fan"
  | "droplets"
  | "home"
  | "cpu";

export type FlowDirection = "to_home" | "from_home" | "bidirectional";

export interface CustomFlowNode {
  id: string;
  name: string;
  entity_id: string;
  icon: CustomFlowIcon;
  direction: FlowDirection;
  color: string;
}

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
  battery_discharge_today: string;
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
  hp_status: string;
  hp_comp_starts: string;
  hp_comp_hours: string;
  hp_backup_hours: string;
  hp_flow_temp: string;
  hp_return_temp: string;
  hp_outside_temp: string;
  hp_source_in_temp: string;
  hp_source_out_temp: string;
  hp_room_temp: string;
}

export interface EconomicSettings {
  energy_price_mode: "fixed" | "entity";
  energy_price: number;
  energy_price_entity: string | null;
  feed_in_tariff: number;
  co2_factor: number;
  pv_investment_cost: number;
  pv_installation_date: string;
  pv_previous_savings: number;
  battery_investment_cost: number;
  battery_installation_date: string;
  battery_previous_savings: number;
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
  custom_flow_nodes: CustomFlowNode[];
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

export interface HeatpumpTempPoint {
  time: string;
  flow: number | null;
  returnTemp: number | null;
  outside: number | null;
  room: number | null;
  sourceIn: number | null;
  sourceOut: number | null;
  spread: number | null;
}

export interface HeatpumpCycleSegment {
  status: string;
  start: number;
  end: number;
  durationMin: number;
}

export interface HeatpumpAnalysis {
  loading: boolean;
  error: string | null;
  lastAnalyzed: number | null;
  hoursWindow: number;
  heatCycles: number;
  avgHeatMinutes: number;
  avgStandbyMinutes: number;
  otShutdownCount: number;
  compStartsDelta: number | null;
  compHoursDelta: number | null;
  backupHoursDelta: number | null;
  avgSpreadK: number | null;
  outsideAvg: number | null;
  outsideMin: number | null;
  outsideMax: number | null;
  roomAvg: number | null;
  sourceInAvg: number | null;
  sourceOutAvg: number | null;
  sourceSpreadK: number | null;
  tempSeries: HeatpumpTempPoint[];
  recentCycles: HeatpumpCycleSegment[];
}

export interface DashboardState {
  solar_power: number;
  grid_power: number;
  home_power: number;
  battery_power: number;
  battery_soc: number | null;
  battery_cycles: number | null;
  battery_discharge_today: number | null;
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
  hp_live_status: string | null;
  hp_live_flow: number | null;
  hp_live_return: number | null;
  hp_live_outside: number | null;
  hp_live_room: number | null;
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
  periodBuckets: PeriodBucket[];
  heatpump: HeatpumpAnalysis;
}
