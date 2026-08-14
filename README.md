# ioBroker.autism-support

Support for people with autism in ioBroker: **Visual Countdown**, **daily schedule with time bar**, and pictograms.

## Visual Countdown

Visual countdown as a geometry frame (default: square) with circular progress wipe from the center.

### States (`autism-support.0.timer.*`)

| State | Description |
|-------|-------------|
| `duration` | Total duration in seconds |
| `remaining` | Remaining seconds |
| `elapsed` | Elapsed seconds |
| `running` / `paused` / `finished` | Status |
| `start` / `pause` / `resume` / `stop` | Commands (write `true`) |
| `setDurationHours` / `setDurationMinutes` | Set duration |

### VIS-2 widgets

| Widget | Purpose |
|--------|---------|
| **Visual Countdown (Live)** | Large display for the user |
| **Visual Countdown (Config)** | Control for parents/caregivers |

## Daily schedule with time bar

Flexible list of pictograms with individual time spans. A **colored day-period bar** on the right adapts to **count and duration of pictograms** (time window from first to last entry), plus a **now** marker.

### Admin: day periods

In the admin tab **Day periods** you can configure start/end (HH:MM) and color per period. Night may wrap past midnight (e.g. 21:00–06:00). In the **Daily Schedule (Config)** widget, periods can additionally be enabled or disabled.

### States (`autism-support.0.schedule.*`)

| State | Description |
|-------|-------------|
| `plan` | JSON plan with entries (label, start/end, pictogram source) |
| `periods` | Day periods from admin config (JSON, read-only) |
| `periodOverrides` | On/off overrides from config widget (JSON, writable) |
| `clearAfterLast` | Clear plan after last pictogram ends (boolean) |
| `nowMinutes` | Current minutes since midnight (local) |
| `currentPeriod` | ID of current day period |
| `currentItemIndex` | Index of active plan entry (`-1` = none) |

### VIS-2 widgets

| Widget | Purpose |
|--------|---------|
| **Daily Schedule (Live)** | Pictograms + time bar display |
| **Daily Schedule (Config)** | Edit entries, reset, auto-clear, period toggles, ARASAAC, upload |

### Pictogram sources

1. **ARASAAC (external)** – only pictogram ID is stored; image is loaded at runtime from `static.arasaac.org`. No ARASAAC files in the adapter package.
2. **Custom uploads** – via config widget into `autism-support.X/pictograms/` (images you have rights to use only).

## Development

Requirements: Node.js ≥ 22, ioBroker with `vis-2`.

```bash
npm install
cd src-widgets-ts && npm install && cd ..
npm run build
npm run dev-server setup
npm run dev-server watch
```

Widget development (parallel):

```bash
cd src-widgets-ts
npm run start
```

## Changelog

See [CHANGELOG_OLD.md](CHANGELOG_OLD.md) for older entries.

### 0.1.11
- Fix ioBroker repository checker issues (admin UI, workflows, metadata)

### 0.1.10
- Fix clear-after-last checkbox; highlight active pictogram by current time

### 0.1.9
- Schedule reset with confirmation; optional auto-clear after last pictogram

### 0.1.8
- Log-compress empty lead/trail on the time bar

### 0.1.7
- Fix period toggles; fixed pictogram size, period bar grows for short spans

### 0.1.6
- Shared scroll; single pictogram cards; overlap columns

### 0.1.5
- Stretch period bar by pictogram count; clock-accurate now marker

## License

### This adapter

**MIT** – see [LICENSE](LICENSE).

### ARASAAC pictograms (external content)

This adapter **does not contain or redistribute** ARASAAC image files.

- **Source:** [ARASAAC](https://arasaac.org) / [API](https://api.arasaac.org) / CDN `https://static.arasaac.org`
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- **Author:** Sergio Palao · **Owner:** Government of Aragon

Recommended attribution:

> The pictographic symbols used are the property of the Government of Aragon and have been created by Sergio Palao for ARASAAC (https://arasaac.org), which distributes them under a Creative Commons license (BY-NC-SA).

Live/config widgets show this attribution when the plan contains ARASAAC entries.

Official terms: [ARASAAC Terms of Use](https://aulaabierta.arasaac.org/en/terms-of-use)

### Custom / uploaded pictograms

You are responsible for having the required rights for uploads. The adapter stores files locally in the instance only; they are not shipped in the npm/GitHub package.

## Author

Matthias Ulrich ([@MatthiasUlrich1](https://github.com/MatthiasUlrich1))
