# ioBroker.autism-support

Unterstützung für Menschen mit Autismus in ioBroker: **Visual Countdown**, **Tagesplan mit Zeitbalken** und Piktogrammen.

## Visual Countdown

Visueller Countdown als Geometrie-Rahmen (Standard: Quadrat) mit kreisförmigem Fortschritts-Wisch vom Zentrum.

### Datenpunkte (`autism-support.0.timer.*`)

| State | Beschreibung |
|-------|--------------|
| `duration` | Gesamtdauer in Sekunden |
| `remaining` | Verbleibende Sekunden |
| `elapsed` | Abgelaufene Sekunden |
| `running` / `paused` / `finished` | Status |
| `start` / `pause` / `resume` / `stop` | Befehle (Schreiben `true`) |
| `setDurationHours` / `setDurationMinutes` | Dauer setzen |

### VIS-2-Widgets

| Widget | Zweck |
|--------|--------|
| **Visual Countdown (Live)** | Große Anzeige für den Nutzer |
| **Visual Countdown (Config)** | Steuerung für Eltern/Pflegeperson |

## Tagesplan mit Zeitbalken

Flexible Liste von Piktogrammen mit jeweils eigener Zeitspanne. Rechts daneben ein **farbiger Tagesbereich-Balken** (Morgens, Vormittag, Mittag, Nachmittag, Abend, Nacht) und ein **Balken für die aktuelle Uhrzeit**.

### Admin: Tagesbereiche

Im Admin-Tab **Tagesbereiche** lassen sich Start/Ende (HH:MM) und Farbe je Bereich einstellen. Nacht darf über Mitternacht gehen (z. B. 21:00–06:00).

### Datenpunkte (`autism-support.0.schedule.*`)

| State | Beschreibung |
|-------|--------------|
| `plan` | JSON-Plan mit Einträgen (Label, Start/Ende, Piktogramm-Quelle) |
| `periods` | Tagesbereiche aus der Admin-Konfiguration (JSON, nur lesen) |
| `nowMinutes` | Aktuelle Minuten seit Mitternacht (lokal) |
| `currentPeriod` | ID des aktuellen Tagesbereichs |
| `currentItemIndex` | Index des aktiven Planeintrags (`-1` = keiner) |

### VIS-2-Widgets

| Widget | Zweck |
|--------|--------|
| **Tagesplan (Live)** | Anzeige Piktogramme + Zeitbalken |
| **Tagesplan (Konfiguration)** | Einträge hinzufügen/bearbeiten, ARASAAC-Suche, eigener Upload |

### Piktogramm-Quellen

1. **ARASAAC (extern)** – nur Pictogramm-ID speichern; Bild wird zur Laufzeit von `static.arasaac.org` geladen. Keine ARASAAC-Dateien im Adapter-Paket.
2. **Eigene Uploads** – über das Config-Widget in `autism-support.X/pictograms/` speichern (nur Bilder, für die Sie die Rechte haben).

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

## Lizenzen

### Dieser Adapter

**MIT** – siehe [LICENSE](LICENSE).

### ARASAAC-Piktogramme (externe Inhalte)

Dieser Adapter **enthält und redistribuiert keine** ARASAAC-Bilddateien.

- **Quelle:** [ARASAAC](https://arasaac.org) / [API](https://api.arasaac.org) / CDN `https://static.arasaac.org`
- **Lizenz:** [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Autor der Piktogramme:** Sergio Palao
- **Eigentümer:** Regierung von Aragón (Gobierno de Aragón)

**Pflichten bei Nutzung (Auszug):**

- Namensnennung (Attribution) von Autor, Quelle und Lizenz
- **Keine kommerzielle Nutzung** der ARASAAC-Piktogramme
- Abgeleitete Werke unter derselben Lizenz (ShareAlike), sofern Sie solche erstellen/verbreiten

Empfohlene Attribution (wie von ARASAAC empfohlen):

> The pictographic symbols used are the property of the Government of Aragon and have been created by Sergio Palao for ARASAAC (https://arasaac.org), which distributes them under a Creative Commons license (BY-NC-SA).

Deutsch:

> Die verwendeten Piktogramme sind Eigentum der Regierung von Aragón und wurden von Sergio Palao für ARASAAC (https://arasaac.org) erstellt; sie werden unter der Creative-Commons-Lizenz BY-NC-SA bereitgestellt.

Das Live-/Config-Widget zeigt diese Attribution automatisch, sobald mindestens ein ARASAAC-Eintrag im Plan ist.

Offizielle Hinweise: [ARASAAC Terms of Use](https://aulaabierta.arasaac.org/en/terms-of-use) und die Website [arasaac.org](https://arasaac.org).

### Eigene / hochgeladene Piktogramme

Für Uploads sind **Sie** verantwortlich, dass Sie die erforderlichen Rechte besitzen. Der Adapter speichert diese Dateien nur lokal in der Adapter-Instanz und liefert sie nicht als Teil des npm-/GitHub-Pakets aus.

## Autor

Matthias Ulrich ([@MatthiasUlrich1](https://github.com/MatthiasUlrich1))
