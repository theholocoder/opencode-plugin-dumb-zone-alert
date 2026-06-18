# dumb-zone-alert

> Get notified before your LLM loses its mind.

An [OpenCode](https://opencode.ai) plugin that tracks token consumption per session and fires desktop alerts when you approach the **dumb zone**: the point where a context window is so saturated that model quality degrades.

---

## What is the Dumb Zone?

LLMs have a fixed context window. As the conversation grows, the model has to juggle more and more tokens, and past a certain point it starts dropping the ball: forgetting earlier instructions, hallucinating, repeating itself. That degraded region is the **dumb zone**.

The problem is that there's no built-in warning. You only notice when the output quality tanks. This plugin watches your token consumption in real time and alerts you at configurable thresholds so you can decide to start a fresh session before things go sideways.

---

## Features

- **Three alert tiers** — 50 %, 75 %, and 100 % of your configured threshold
- **Desktop notifications** via `notify-send` with urgency levels (`low`, `normal`, `critical`)
- **TUI toasts** displayed inside OpenCode's terminal UI (with graceful fallback if unavailable)
- **Per-session deduplication** — each threshold fires at most once per session, no spam
- **Per-project context** — the notification title includes the current project name
- **Fully configurable** — adjust the token threshold, ratios, urgency levels, and messages

---

## Prerequisites

- **OpenCode** installed and working
- **`notify-send`** available on your system (Linux with `libnotify`)
  - Install on Debian/Ubuntu: `sudo apt install libnotify-bin`
  - Install on Arch: `sudo pacman -S libnotify`
- **macOS / Windows**: `notify-send` is not natively available. Desktop notifications will silently fail; TUI toasts will still work.

---

## Installation

1. Copy or clone `dumb-zone-alert.js` on your machine, e.g.:

   ```
   ~/.config/opencode/plugins/dumb-zone-alert.js
   ```

2. Restart OpenCode. The plugin loads automatically on startup.

---

## Configuration

All configurable values are at the top of `dumb-zone-alert.js`.

### `TOKEN_THRESHOLD`

The total token count that represents your model's effective limit. Tiers are calculated as percentages of this value.

```js
const TOKEN_THRESHOLD = 100_000; // adjust to your model's context window
```

### `TIERS`

Defines the ratio, visual level, `notify-send` urgency, and display label for each alert tier.

```js
const TIERS = [
  { ratio: 0.5,  level: "info",    urgency: "low",      label: "50 %"  },
  { ratio: 0.75, level: "warning", urgency: "normal",   label: "75 %"  },
  { ratio: 1.0,  level: "error",   urgency: "critical", label: "100 %" },
];
```

### `MESSAGES`

The body text of each notification, keyed by ratio.

```js
const MESSAGES = {
  0.5:  "We're half way to the dumb zone!",
  0.75: "Be careful, the dumb zone is about to be reached!",
  1.0:  "You reached the dumb zone, you should start a new session.",
};
```

---

## License

MIT — see `LICENSE` file.
