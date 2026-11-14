import { useEffect, useState } from "react";
import {
  Battery,
  Bell,
  Camera,
  Clock,
  DollarSign,
  Download,
  LayoutDashboard,
  Power,
  RefreshCw,
  Upload,
  Zap,
} from "lucide-react";
import { mergeConfig } from "../config/defaults";
import { DashboardConfig, DashboardState, DeviceType, LayoutMode } from "../types/dashboard";
import { cn } from "../utils/formatters";

interface SettingsViewProps {
  state: DashboardState;
  config: DashboardConfig;
  layout: "pc" | "tablet" | "smartphone";
  onSave: (next: Partial<DashboardConfig>) => void;
  onFetchEntities: (url?: string, token?: string) => Promise<void>;
}

const ENTITY_LABELS: Record<string, string> = {
  solar_power: "Solar Leistung (W)",
  grid_power: "Netz Leistung (W)",
  home_power: "Hausverbrauch (W)",
  battery_power: "Batterie Leistung (W)",
  battery_soc: "Batterie Ladestand (%)",
  battery_cycles: "Batterie Ladezyklen",
  battery_discharge_today: "Batterie Entladung Heute (kWh)",
  solar_today: "Solar Ertrag Heute (kWh)",
  solar_forecast_today: "Solar Prognose Heute (kWh)",
  solar_forecast_tomorrow: "Solar Prognose Morgen (kWh)",
  grid_import_today: "Netz Bezug Heute (kWh)",
  grid_export_today: "Netz Einspeisung Heute (kWh)",
  ev_range: "E-Auto Reichweite (km)",
  ev_soc: "E-Auto Ladestand (%)",
  ev_charge_power: "E-Auto Ladeleistung (W)",
  water_meter: "Wasserzählerstand (m³)",
  water_today: "Wasser heute (L)",
  water_temp: "Wassertemperatur (°C)",
  hp_status: "Wärmepumpe Status",
  hp_comp_starts: "WP Verdichterstarts",
  hp_comp_hours: "WP Verdichter-Stunden",
  hp_backup_hours: "WP Heizstab-Stunden",
  hp_flow_temp: "WP Vorlauftemperatur (°C)",
  hp_return_temp: "WP Rücklauftemperatur (°C)",
  hp_outside_temp: "WP Außentemperatur (°C)",
  hp_source_in_temp: "WP Sole Eingang (°C)",
  hp_source_out_temp: "WP Sole Ausgang (°C)",
  hp_room_temp: "WP Wohnzimmer Temp. (°C)",
};

export function SettingsView({
  state,
  config,
  layout,
  onSave,
  onFetchEntities,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<DashboardConfig>(config);
  const [savedNotice, setSavedNotice] = useState(false);
  const [versionInfo, setVersionInfo] = useState<{ version?: string; commit?: string } | null>(null);

  const isPhone = layout === "smartphone";
  const isTablet = layout === "tablet";

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setVersionInfo(data))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    onSave(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voltix-config-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const merged = mergeConfig(parsed);
        setDraft(merged);
        onSave(merged);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      } catch {
        alert("Ungültige JSON-Konfigurationsdatei.");
      }
    };
    reader.readAsText(file);
  };

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
          "flex items-center justify-between max-w-4xl flex-wrap gap-4",
          isPhone && "flex-col items-start"
        )}
      >
        <h1 className={cn("text-3xl font-bold", isPhone && "text-2xl")}>Einstellungen</h1>
        <div className={cn("flex items-center gap-3 flex-wrap", isPhone && "w-full justify-between")}>
          <button
            onClick={() => onFetchEntities(draft.ha_url, draft.token)}
            disabled={state.isFetchingEntities}
            className={cn(
              "flex items-center gap-2 text-xs font-bold transition-colors cursor-pointer",
              state.isFetchingEntities
                ? "text-solar animate-pulse"
                : "text-slate-400 hover:text-solar"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", state.isFetchingEntities && "animate-spin")} />
            {state.isFetchingEntities ? "Lade Entitäten..." : "Entitäten aktualisieren"}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-slate-300 hover:border-solar transition-colors cursor-pointer"
            title="Konfiguration als JSON exportieren"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-slate-300 hover:border-solar transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Import
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>

          <button
            onClick={handleSave}
            className={cn(
              "bg-solar text-bg px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-solar/20 cursor-pointer",
              isPhone && "px-4 py-2 text-sm"
            )}
          >
            {savedNotice ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

      <datalist id="ha-entities">
        {state.availableEntities.map((ent) => (
          <option key={ent.entity_id} value={ent.entity_id}>
            {ent.friendly_name}
          </option>
        ))}
      </datalist>

      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl", isPhone && "gap-4")}>
        {/* Verbindung */}
        <div className="glass p-8 rounded-3xl flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-solar" />
            Verbindung
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Home Assistant URL
              </label>
              <input
                type="text"
                placeholder="https://homeassistant.local:8123"
                value={draft.ha_url}
                onChange={(e) => setDraft({ ...draft, ha_url: e.target.value })}
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Access Token (Langlebiges Token)
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={draft.token}
                onChange={(e) => setDraft({ ...draft, token: e.target.value })}
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Entitäts-Zuweisung */}
        <div className="glass p-8 rounded-3xl flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-battery" />
              Entitäts-Zuweisung
            </span>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full",
                state.isFetchingEntities
                  ? "bg-solar/20 text-solar animate-pulse"
                  : state.entityError
                  ? "bg-red-500/20 text-red-400"
                  : state.availableEntities.length > 0
                  ? "bg-battery/20 text-battery"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {state.isFetchingEntities
                ? "Lade..."
                : state.entityError
                ? "Fehler"
                : `${state.availableEntities.length} geladen`}
            </span>
          </h2>
          {state.entityError && (
            <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              {state.entityError}
            </div>
          )}
          <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2">
            {Object.entries(draft.entities)
              .filter(
                ([key]) =>
                  !["camera_entity", "motion_sensor_entity", "webrtc_url", "top_consumers"].includes(
                    key
                  )
              )
              .map(([key, val]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {ENTITY_LABELS[key] || key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="text"
                    list="ha-entities"
                    value={(val as string) || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        entities: { ...draft.entities, [key]: e.target.value },
                      })
                    }
                    className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery transition-colors"
                  />
                </div>
              ))}
          </div>
        </div>

        {/* Kamera-Einstellungen */}
        <div className="glass p-8 rounded-3xl flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-solar" />
            Kamera & Verbraucher
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Kamera Entität
              </label>
              <input
                type="text"
                list="ha-entities"
                value={draft.entities.camera_entity || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entities: { ...draft.entities, camera_entity: e.target.value },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Bewegungssensor Entität
              </label>
              <input
                type="text"
                list="ha-entities"
                value={draft.entities.motion_sensor_entity || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entities: { ...draft.entities, motion_sensor_entity: e.target.value },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Top Verbraucher (Komma-getrennt)
              </label>
              <input
                type="text"
                list="ha-entities"
                placeholder="z.B. sensor.ev_power, sensor.ac_power"
                value={draft.entities.top_consumers?.join(", ") || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entities: {
                      ...draft.entities,
                      top_consumers: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                WebRTC Stream URL (go2rtc)
              </label>
              <input
                type="text"
                placeholder="https://ha.example.com:8443/webrtc/front_door"
                value={draft.entities.webrtc_url || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    entities: { ...draft.entities, webrtc_url: e.target.value },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Popup-Dauer (Sekunden)
              </label>
              <input
                type="number"
                value={draft.camera_settings.popup_duration}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    camera_settings: {
                      ...draft.camera_settings,
                      popup_duration: parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar transition-colors"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">Benachrichtigungston</span>
              </div>
              <button
                onClick={() =>
                  setDraft({
                    ...draft,
                    camera_settings: {
                      ...draft.camera_settings,
                      play_sound: !draft.camera_settings.play_sound,
                    },
                  })
                }
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative cursor-pointer",
                  draft.camera_settings.play_sound ? "bg-solar" : "bg-slate-700"
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    draft.camera_settings.play_sound ? "left-7" : "left-1"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Smart Geräte */}
        <div className="glass p-8 rounded-3xl flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Power className="w-5 h-5 text-accent" />
            Smart Geräte
          </h2>
          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2">
            {draft.smart_devices.map((dev, idx) => (
              <div
                key={dev.id}
                className="p-4 bg-surface/50 border border-border rounded-2xl flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Gerät {idx + 1}
                  </span>
                  <button
                    onClick={() => {
                      const next = [...draft.smart_devices];
                      next.splice(idx, 1);
                      setDraft({ ...draft, smart_devices: next });
                    }}
                    className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase cursor-pointer"
                  >
                    Entfernen
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Name</label>
                    <input
                      type="text"
                      value={dev.name}
                      onChange={(e) => {
                        const next = [...draft.smart_devices];
                        next[idx] = { ...dev, name: e.target.value };
                        setDraft({ ...draft, smart_devices: next });
                      }}
                      className="bg-surface p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Typ</label>
                    <select
                      value={dev.type}
                      onChange={(e) => {
                        const next = [...draft.smart_devices];
                        next[idx] = { ...dev, type: e.target.value as DeviceType };
                        setDraft({ ...draft, smart_devices: next });
                      }}
                      className="bg-surface p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-accent"
                    >
                      <option value="switch">Schalter</option>
                      <option value="light">Licht</option>
                      <option value="climate">Klima</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Entitäts-ID
                  </label>
                  <input
                    type="text"
                    list="ha-entities"
                    value={dev.entity_id}
                    onChange={(e) => {
                      const next = [...draft.smart_devices];
                      next[idx] = { ...dev, entity_id: e.target.value };
                      setDraft({ ...draft, smart_devices: next });
                    }}
                    className="bg-surface p-2 rounded-lg border border-border text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setDraft({
                  ...draft,
                  smart_devices: [
                    ...draft.smart_devices,
                    { id: `device_${Date.now()}`, name: "Neues Gerät", entity_id: "", type: "switch" },
                  ],
                })
              }
              className="w-full py-3 border border-dashed border-border rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all cursor-pointer"
            >
              + Smart Gerät hinzufügen
            </button>
          </div>
        </div>

        {/* Wirtschaftlichkeit */}
        <div className="glass p-8 rounded-3xl flex flex-col gap-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-battery" />
            Wirtschaftlichkeit & Öko
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 p-4 bg-surface rounded-2xl border border-border">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Energiepreis Modus
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="energy_price_mode"
                    checked={draft.economic_settings.energy_price_mode === "fixed"}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          energy_price_mode: "fixed",
                        },
                      })
                    }
                    className="accent-battery"
                  />
                  <span className="text-sm">Fixer Preis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="energy_price_mode"
                    checked={draft.economic_settings.energy_price_mode === "entity"}
                    onChange={() =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          energy_price_mode: "entity",
                        },
                      })
                    }
                    className="accent-battery"
                  />
                  <span className="text-sm">Dynamisch (Entität)</span>
                </label>
              </div>
              {draft.economic_settings.energy_price_mode === "fixed" ? (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Energiepreis (€/kWh)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.economic_settings.energy_price}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          energy_price: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Energiepreis Entität
                  </label>
                  <input
                    type="text"
                    list="ha-entities"
                    value={draft.economic_settings.energy_price_entity || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          energy_price_entity: e.target.value,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Einspeisevergütung (€/kWh)
              </label>
              <input
                type="number"
                step="0.01"
                value={draft.economic_settings.feed_in_tariff}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    economic_settings: {
                      ...draft.economic_settings,
                      feed_in_tariff: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                CO₂-Faktor (kg/kWh)
              </label>
              <input
                type="number"
                step="0.01"
                value={draft.economic_settings.co2_factor}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    economic_settings: {
                      ...draft.economic_settings,
                      co2_factor: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
              />
            </div>

            <div className="h-px bg-border my-1" />

            <div className="flex flex-col gap-3 p-4 bg-surface/60 rounded-2xl border border-border">
              <span className="text-xs font-bold text-solar uppercase tracking-wider">
                PV-Anlage Amortisation
              </span>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Anschaffungskosten PV (€)
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="z.B. 12000"
                  value={draft.economic_settings.pv_investment_cost}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      economic_settings: {
                        ...draft.economic_settings,
                        pv_investment_cost: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Inbetriebnahme
                  </label>
                  <input
                    type="date"
                    value={draft.economic_settings.pv_installation_date}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          pv_installation_date: e.target.value,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Bisherige Ersparnis (€)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    placeholder="0"
                    value={draft.economic_settings.pv_previous_savings}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          pv_previous_savings: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-surface/60 rounded-2xl border border-border">
              <span className="text-xs font-bold text-battery uppercase tracking-wider">
                Batteriespeicher Amortisation
              </span>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Anschaffungskosten Batterie (€)
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="z.B. 5000"
                  value={draft.economic_settings.battery_investment_cost}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      economic_settings: {
                        ...draft.economic_settings,
                        battery_investment_cost: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Inbetriebnahme
                  </label>
                  <input
                    type="date"
                    value={draft.economic_settings.battery_installation_date}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          battery_installation_date: e.target.value,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Bisherige Ersparnis (€)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    placeholder="0"
                    value={draft.economic_settings.battery_previous_savings}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        economic_settings: {
                          ...draft.economic_settings,
                          battery_previous_savings: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="bg-bg p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-battery"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Batterie & Anzeige */}
        <div className="flex flex-col gap-8">
          <div className="glass p-8 rounded-3xl flex flex-col gap-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Battery className="w-5 h-5 text-solar" />
              Batterie-Einstellungen
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Kapazität (kWh)
                </label>
                <input
                  type="number"
                  value={draft.battery_settings.capacity_kwh}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      battery_settings: {
                        ...draft.battery_settings,
                        capacity_kwh: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Max. Zyklen (Lebensdauer)
                </label>
                <input
                  type="number"
                  value={draft.battery_settings.max_cycles}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      battery_settings: {
                        ...draft.battery_settings,
                        max_cycles: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                  className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-solar"
                />
              </div>
            </div>
          </div>

          <div className="glass p-8 rounded-3xl flex flex-col gap-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-accent" />
              Anzeige-Optimierung
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Geräte-Profil
                </label>
                <select
                  value={draft.ui_settings.layout_mode}
                  onChange={(e) => {
                    const lm = e.target.value as LayoutMode;
                    setDraft({
                      ...draft,
                      ui_settings: { ...draft.ui_settings, layout_mode: lm },
                    });
                  }}
                  className="bg-surface p-3 rounded-xl border border-border text-sm focus:outline-none focus:border-accent"
                >
                  <option value="auto">Automatisch (Responsive)</option>
                  <option value="pc">Desktop PC</option>
                  <option value="tablet">Tablet</option>
                  <option value="smartphone">Smartphone</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Widget-Skalierung ({draft.ui_settings.widget_scale}%)
                </label>
                <input
                  type="range"
                  min="50"
                  max="150"
                  step="5"
                  value={draft.ui_settings.widget_scale}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ui_settings: {
                        ...draft.ui_settings,
                        widget_scale: parseInt(e.target.value, 10),
                      },
                    })
                  }
                  className="accent-accent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System-Info */}
      <div className="glass p-8 rounded-3xl max-w-4xl">
        <h2 className="text-xl font-bold mb-4">System-Info</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                state.connected
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                  : "bg-red-500"
              )}
            />
            <span>
              {state.connected ? "Verbunden mit Home Assistant" : "Nicht verbunden"}
            </span>
          </div>
          <div className="w-1 h-1 bg-slate-700 rounded-full" />
          <span>
            Letztes Update:{" "}
            {state.lastUpdated
              ? new Date(state.lastUpdated).toLocaleTimeString()
              : "Noch keine Daten"}
          </span>
          {versionInfo?.version && (
            <>
              <div className="w-1 h-1 bg-slate-700 rounded-full" />
              <span>
                Version: v{versionInfo.version}
                {versionInfo.commit ? ` (${versionInfo.commit.slice(0, 7)})` : ""}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
