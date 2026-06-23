// =============================================================================
// dumb-zone-alert.js — OpenCode plugin
// Sends a notify-send alert when the session token threshold is exceeded.
// Threshold and tier messages are configurable below.
// =============================================================================

// --- Configuration -----------------------------------------------------------
// Adjust TOKEN_THRESHOLD to match your model's context limit.
// Tiers are calculated as percentages of this value.

const TOKEN_THRESHOLD = 100_000;

const TIERS = [
  { ratio: 0.5, level: "info", urgency: "low", label: "50 %" },
  { ratio: 0.75, level: "warning", urgency: "normal", label: "75 %" },
  { ratio: 1.0, level: "error", urgency: "critical", label: "100 %" },
];

const MESSAGES = {
  0.5: "We're half way to the dumb zone!",
  0.75: "Be careful, the dumb zone is about to be reached!",
  1.0: "You reached the dumb zone, you should start a new session.",
};

export const DumbZoneAlert = async ({ client, $, directory }) => {
  const { basename } = await import("path");
  const project = basename(directory ?? "unknown");

  let hasNotifySend = false;
  try {
    // Check if notify-send is available
    await $`which notify-send`.text();

    // Check if D-Bus socket exists
    const uid = process.getuid?.() ?? 1000;
    const sockPath = `/run/user/${uid}/bus`;
    await $`test -S ${sockPath}`;

    // Notify-send is available and D-Bus socket exists
    hasNotifySend = true;
  } catch {
    /** silent */
  }

  // Map<sessionID, { prevInput, prevCacheRead, contextTotal, alerted: Set<ratio> }>
  const sessionState = new Map();

  function getState(sessionId) {
    if (!sessionState.has(sessionId)) {
      sessionState.set(sessionId, {
        prevInput: 0,
        prevCacheRead: 0,
        contextTotal: 0,
        alerted: new Set(),
        initialized: false,
      });
    }
    return sessionState.get(sessionId);
  }

  async function checkThresholds(sessionId, contextTotal) {
    const state = getState(sessionId);

    for (const tier of [...TIERS].reverse()) {
      const threshold = Math.floor(TOKEN_THRESHOLD * tier.ratio);
      if (contextTotal < threshold) continue;
      if (state.alerted.has(tier.ratio)) continue;

      state.alerted.add(tier.ratio);

      const title = `Dumb zone alert (${project})`;
      const msg = MESSAGES[tier.ratio];

      // Primary: notify-send
      if (hasNotifySend) {
        try {
          await $`notify-send -u ${tier.urgency} ${title} ${msg}`;
        } catch {
          /* silent */
        }
      }

      // Bonus: TUI toast (may fail)
      try {
        await client.tui.showToast({
          body: { message: `${title} — ${msg}`, variant: tier.level },
        });
      } catch {
        /* silent */
      }
    }
  }

  return {
    event: async ({ event }) => {
      if (event?.type !== "session.updated") return;

      const sessionId = event?.properties?.sessionID;
      const tokens = event?.properties?.info?.tokens;
      if (!sessionId || !tokens) return;

      const state = getState(sessionId);
      const currentInput = tokens.input ?? 0;
      const currentCacheRead = tokens.cache?.read ?? 0;

      if (!state.initialized) {
        // First event: store as baseline, don't compute delta
        state.prevInput = currentInput;
        state.prevCacheRead = currentCacheRead;
        state.initialized = true;
        return;
      }

      const deltaInput = currentInput - state.prevInput;
      const deltaCacheRead = currentCacheRead - state.prevCacheRead;

      if (
        deltaInput >= 0 &&
        deltaCacheRead >= 0 &&
        deltaInput + deltaCacheRead > 0
      ) {
        state.contextTotal = deltaInput + deltaCacheRead;
        state.prevInput = currentInput;
        state.prevCacheRead = currentCacheRead;
        // Check thresholds immediately after each meaningful update
        try {
          await checkThresholds(sessionId, state.contextTotal);
        } catch {
          /* silent */
        }
      } else {
        state.prevInput = currentInput;
        state.prevCacheRead = currentCacheRead;
      }
    },
  };
};

export default DumbZoneAlert;
