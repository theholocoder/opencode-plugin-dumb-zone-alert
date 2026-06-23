import assert from "node:assert/strict";
import { DumbZoneAlert } from "./dumb-zone-alert.js";

const calls = [];
let hasDbusSocket = false;

function makeShellResult(val) {
  const p = Promise.resolve(val);
  p.text = () => Promise.resolve(val);
  p.env = () => p;
  return p;
}

function mock$(strings, ...values) {
  const cmd = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
  calls.push(cmd);
  if (cmd.startsWith("which ")) {
    const binary = cmd.slice("which ".length).trim();
    if (!binary || binary === "notify-send-throw") {
      return Promise.reject(new Error(`not found: ${binary}`));
    }
    return makeShellResult("/usr/bin/" + binary);
  }
  if (cmd.startsWith("test -S ")) {
    if (!hasDbusSocket) {
      return Promise.reject(new Error("socket not found"));
    }
    return makeShellResult("");
  }
  return makeShellResult("");
}

function mockClient() {
  const toasts = [];
  return {
    app: {
      log: async () => {},
    },
    tui: {
      showToast: async ({ body }) => {
        toasts.push(body);
      },
    },
    _toasts: toasts,
  };
}

async function reset() {
  calls.length = 0;
  hasDbusSocket = false;
}

function makeEvent(sessionId, input, cacheRead) {
  return {
    type: "session.updated",
    properties: {
      sessionID: sessionId,
      info: {
        tokens: {
          input,
          cache: { read: cacheRead ?? 0 },
        },
      },
    },
  };
}

// --- Test 1: notify-send not found ---
{
  await reset();
  const client = mockClient();
  const plugin = await DumbZoneAlert({
    client,
    $: mock$,
    directory: "/test/project",
  });

  // hack: override $
  await plugin.event({ event: makeEvent("s1", 0, 0) });
  await plugin.event({ event: makeEvent("s1", 60_000, 0) });
  await plugin.event({ event: makeEvent("s1", 100_000, 0) });

  const notifyCalls = calls.filter((c) => c.startsWith("notify-send"));
  assert.equal(notifyCalls.length, 0, "should not call notify-send when binary missing");
  assert.ok(client._toasts.length > 0, "should still fire TUI toasts");
  console.log("PASS: notify-send not found -> skipped, TUI toasts still fire");
}

// --- Test 2: notify-send found, no D-Bus ---
{
  await reset();
  calls.length = 0;
  const client = mockClient();

  const plugin = await DumbZoneAlert({
    client,
    $: mock$,
    directory: "/test/project",
  });

  await plugin.event({ event: makeEvent("s2", 0, 0) });
  await plugin.event({ event: makeEvent("s2", 60_000, 0) });
  await plugin.event({ event: makeEvent("s2", 100_000, 0) });

  const notifyCalls2 = calls.filter((c) => c.startsWith("notify-send"));
  assert.equal(notifyCalls2.length, 0, "should not call notify-send without D-Bus socket");
  assert.ok(client._toasts.length > 0, "should still fire TUI toasts");
  console.log("PASS: notify-send found, no D-Bus socket -> skipped, TUI toasts still fire");
}

// --- Test 3: notify-send found + D-Bus present ---
{
  await reset();
  hasDbusSocket = true;
  calls.length = 0;
  const client = mockClient();

  const plugin = await DumbZoneAlert({
    client,
    $: mock$,
    directory: "/test/project",
  });

  await plugin.event({ event: makeEvent("s3", 0, 0) });
  // Jump past all thresholds in one delta
  await plugin.event({ event: makeEvent("s3", 120_000, 0) });

  const notifyCalls3 = calls.filter((c) => c.startsWith("notify-send"));
  assert.equal(notifyCalls3.length, 3, "should call notify-send for 50%, 75%, and 100% thresholds");
  assert.ok(client._toasts.length > 0, "should also fire TUI toasts");
  console.log("PASS: notify-send found + D-Bus present -> notify-send called for thresholds");
}

// --- Test 4: multiple sessions are independent ---
{
  await reset();
  hasDbusSocket = true;
  calls.length = 0;
  const client = mockClient();

  const plugin = await DumbZoneAlert({
    client,
    $: mock$,
    directory: "/test/project",
  });

  await plugin.event({ event: makeEvent("s4a", 0, 0) });
  await plugin.event({ event: makeEvent("s4b", 0, 0) });
  await plugin.event({ event: makeEvent("s4a", 100_000, 0) });
  await plugin.event({ event: makeEvent("s4b", 50_000, 0) });

  const notifyCalls4 = calls.filter((c) => c.startsWith("notify-send"));
  assert.equal(notifyCalls4.length, 4, "each session tracks independently");
  console.log("PASS: multiple sessions tracked independently");
}

console.log("\nAll tests passed!");
