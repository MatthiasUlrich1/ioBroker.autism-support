# ioBroker.autism-support

Unterstützung für Menschen mit Autismus in ioBroker: **Visual Countdown**, Bild-Ablaufpläne (geplant) und Piktogramme (geplant).

## Visual Countdown (MVP)

Visueller Countdown als **Fortschrittsring** (keine gefüllte Scheibe):

- Orangener Fortschrittsring (Farbe in den Widget-Einstellungen änderbar)
- Graue Spur für abgelaufene Zeit
- Kleine Ringe für volle Stunden
- Digitale Anzeige darunter

### Datenpunkte (`autism-support.0.timer.*`)

| State | Beschreibung |
|-------|--------------|
| `duration` | Gesamtdauer in Sekunden |
| `remaining` | Verbleibende Sekunden |
| `elapsed` | Abgelaufene Sekunden |
| `running` / `paused` / `finished` | Status |
| `start` / `pause` / `resume` / `stop` | Befehle (Schreiben `true`) |
| `setDurationHours` / `setDurationMinutes` | Dauer setzen |

### Admin

Instanz-Konfiguration: Standard-Dauer (Stunden/Minuten) und maximale Stunden (1–24).

### VIS-2-Widgets

| Widget | Zweck |
|--------|--------|
| **Visual Countdown (Live)** | Große Anzeige für den Nutzer |
| **Visual Countdown (Config)** | Steuerung für Eltern/Pflegeperson |

## Entwicklung

Voraussetzungen: Node.js ≥ 20, ioBroker mit `vis-2`.

```bash
npm install
cd src-widgets-ts && npm install && cd ..
npm run build
npm run dev-server setup
npm run dev-server watch
```

Widget-Entwicklung (parallel):

```bash
cd src-widgets-ts
npm run start
```

## Lizenz

MIT

## Autor

Matthias Ulrich ([@MatthiasUlrich1](https://github.com/MatthiasUlrich1))
