# Voltix – Home Assistant Energie Dashboard

Modernes, responsives Energie-Dashboard für Home Assistant mit Echtzeit-Energiefluss, Verlaufsanalysen, Langzeittrends, E-Auto-Steuerung und Kamera-Bewegungspopup.

## Features & Verbesserungen (v2.0)
- **Modulare TypeScript-Architektur** (`React 19`, `Vite`, `Tailwind CSS v4`, `Recharts`, `Framer Motion`)
- **Integrierter Node.js HA-Proxy** (`/api/ha-proxy/*`) – kein CORS-Problem beim Betrieb im Docker-Container
- **Echte Berechnungen statt Dummy-Daten** (korrekte `home_power`-Logik, Einspeisevergütung in Ersparnis, reale Monats-/Wochentrends, Batterierestlaufzeit)
- **Automatisches Responsive Layout** für Desktop, Tablet und Smartphone
- **Export & Import** der Konfiguration als JSON-Datei

---

## Installation auf Proxmox (LXC / VM mit Docker)

In einem Debian/Ubuntu LXC-Container auf Proxmox:

```bash
REPO_URL="https://github.com/DEIN_USER/DEIN_REPO.git" bash <(curl -fsSL https://raw.githubusercontent.com/DEIN_USER/DEIN_REPO/main/scripts/proxmox-install.sh)
```

Danach ist das Dashboard standardmäßig unter `http://<LXC-IP>:8080` erreichbar.

---

## Update bei Änderungen auf GitHub

Auf dem Proxmox-Container reicht ein einziger Befehl:

```bash
voltix-update
```

Das Skript prüft auf neue Commits auf GitHub, baut bei Änderungen automatisch das neue Docker-Image und startet den Container neu – deine Einstellungen im Browser bleiben erhalten.

*(Optional: Über `.github/workflows/docker-publish.yml` wird bei jedem Push auf `main` zusätzlich ein fertiges Multi-Arch-Image auf `ghcr.io` veröffentlicht, das sich auch mit Watchtower automatisch aktualisieren lässt.)*
