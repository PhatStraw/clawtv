#!/usr/bin/env node
/**
 * clawtv — ADB tool executor for Claude Code
 * https://github.com/phatstraw/clawtv
 *
 * Claude Code reads the skill and calls this CLI directly.
 * No API keys. No config files. Just ADB + Claude Code.
 *
 * Commands:
 *   clawtv setup             ← auto-finds your TV and saves config
 *   clawtv scan              ← finds your TV on the network
 *   clawtv connect
 *   clawtv screenshot
 *   clawtv press <key> [times]
 *   clawtv launch <app>
 *   clawtv type "<text>"
 *   clawtv volume <up|down|mute> [steps]
 *   clawtv power <on|off|toggle>
 *   clawtv push <local_path> [remote_path]
 *   clawtv wait [seconds]
 *   clawtv state
 */

const { execSync } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Config ─────────────────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), ".clawtv");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const SCREEN_PATH = path.join(CONFIG_DIR, "screen.png");

// Ensure ~/.clawtv dir exists
fs.mkdirSync(CONFIG_DIR, { recursive: true });

// Load saved config (if any)
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(ip, port) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ip, port }, null, 2) + "\n");
}

const savedConfig = loadConfig();

// Resolution: env vars override config file (backward compat)
const TV_IP = process.env.CLAWTV_IP || process.env.TV_IP || savedConfig.ip || null;
const TV_PORT = process.env.CLAWTV_PORT || process.env.TV_PORT || savedConfig.port || "5555";

// ── Known apps ─────────────────────────────────────────────────────────────
const KNOWN_APPS = {
  "apple tv": {
    pkg: "com.apple.atve.androidtv.appletv",
    activity: "com.apple.atve.androidtv.appletv/.MainActivity",
  },
  netflix: {
    pkg: "com.netflix.ninja",
    activity: "com.netflix.ninja/.MainActivity",
  },
  youtube: {
    pkg: "com.google.android.youtube.tv",
    activity:
      "com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity",
  },
  hulu: { pkg: "com.hulu.livingroom", activity: null },
  "disney+": { pkg: "com.disney.disneyplus", activity: null },
  "disney plus": { pkg: "com.disney.disneyplus", activity: null },
  max: { pkg: "com.hbo.hbonow", activity: null },
  hbo: { pkg: "com.hbo.hbonow", activity: null },
  amazon: { pkg: "com.amazon.amazonvideo.livingroom", activity: null },
  prime: { pkg: "com.amazon.amazonvideo.livingroom", activity: null },
  plex: { pkg: "com.plexapp.android", activity: null },
  spotify: { pkg: "com.spotify.tv.android", activity: null },
  peacock: { pkg: "com.peacocktv.peacockandroid", activity: null },
  paramount: { pkg: "com.cbs.ott", activity: null },
  settings: { pkg: "com.android.tv.settings", activity: null },
};

const KEY_MAP = {
  up: 19,
  down: 20,
  left: 21,
  right: 22,
  select: 23,
  enter: 23,
  ok: 23,
  back: 4,
  home: 3,
  menu: 82,
  play: 85,
  pause: 85,
  playpause: 85,
  stop: 86,
  next: 87,
  previous: 88,
  rewind: 89,
  fastforward: 90,
  volume_up: 24,
  volume_down: 25,
  mute: 164,
  power: 26,
  sleep: 223,
  wake: 224,
};

// ── ADB helpers ────────────────────────────────────────────────────────────
function getTarget() {
  if (!TV_IP) {
    // Try to find a connected device automatically
    const out = adbRaw("devices");
    const lines = out
      .split("\n")
      .filter((l) => l.includes(":5555") && l.includes("device"));
    if (lines.length > 0) {
      return lines[0].split("\t")[0].trim();
    }
    console.error("❌ No TV found. Run: clawtv setup");
    process.exit(1);
  }
  return `${TV_IP}:${TV_PORT}`;
}

function adbRaw(cmd) {
  try {
    return execSync(`adb ${cmd}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function adb(cmd) {
  const target = getTarget();
  try {
    return execSync(`adb -s ${target} ${cmd}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function resolveActivity(pkg) {
  const out = adb(
    `shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER ${pkg}`,
  );
  for (const line of out.split("\n")) {
    if (line.includes("/") && !line.startsWith("priority")) return line.trim();
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Network scan helpers ──────────────────────────────────────────────────
function getLocalSubnet() {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        const parts = addr.address.split(".");
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }
  }
  return null;
}

function fastScan(subnet) {
  return new Promise((resolve) => {
    const found = [];
    let pending = 254;

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      const sock = net.connect({ host: ip, port: 5555, timeout: 1000 });

      sock.on("connect", () => {
        found.push(ip);
        sock.destroy();
      });

      sock.on("timeout", () => {
        sock.destroy();
      });

      sock.on("error", () => {});

      sock.on("close", () => {
        pending--;
        if (pending === 0) resolve(found);
      });
    }
  });
}

// ── Connection check ──────────────────────────────────────────────────────
function ensureConnected() {
  const target = getTarget();
  const out = adbRaw("devices");
  const lines = out
    .split("\n")
    .filter(
      (l) => l.includes(target) && (l.includes("device") && !l.includes("offline")),
    );
  if (lines.length > 0) return true;

  // Try to reconnect
  console.log(`Reconnecting to ${target}...`);
  const connectOut = adbRaw(`connect ${target}`);
  if (
    connectOut.includes("connected to") ||
    connectOut.includes("already connected")
  ) {
    return true;
  }
  console.error(`❌ Cannot reach TV at ${target}`);
  console.error(`   ${connectOut.trim()}`);
  console.error("   Is the TV on? Try: clawtv setup");
  process.exit(1);
}

// ── Commands ───────────────────────────────────────────────────────────────
function cmdConnect() {
  if (!TV_IP) {
    console.error("❌ No TV configured. Run: clawtv setup");
    process.exit(1);
  }
  const target = `${TV_IP}:${TV_PORT}`;
  console.log(`Connecting to ${target}...`);
  const out = adbRaw(`connect ${target}`);
  const ok = out.includes("connected to") || out.includes("already connected");
  if (ok) {
    console.log(`✅ Connected to ${target}`);
  } else {
    console.error(`❌ Connection failed: ${out.trim()}`);
    console.error("   Is the TV on? Is network debugging enabled?");
    process.exit(1);
  }
}

async function cmdScan() {
  console.log("Scanning network for Android TV devices on port 5555...");
  const subnet = getLocalSubnet();
  if (!subnet) {
    console.log("Could not determine local subnet.");
    return;
  }
  console.log(`Scanning ${subnet}.0/24 ...`);

  const found = await fastScan(subnet);

  if (found.length === 0) {
    console.log(
      "No devices found. Make sure ADB debugging is enabled on your TV.",
    );
    console.log("Settings → Developer Options → Network Debugging → ON");
  } else {
    for (const ip of found) {
      console.log(`✅ Found TV at: ${ip}`);
    }
    console.log(`\nTo save this config, run: clawtv setup`);
  }
}

async function cmdSetup() {
  console.log("🔍 Scanning network for Android TV devices...");

  const subnet = getLocalSubnet();
  if (!subnet) {
    console.error("❌ Could not determine local subnet.");
    process.exit(1);
  }

  console.log(`Scanning ${subnet}.0/24 on port 5555...`);

  const found = await fastScan(subnet);

  if (found.length === 0) {
    console.error("❌ No Android TV found on your network.");
    console.error("Make sure ADB debugging is enabled on your TV:");
    console.error("  Settings → Developer Options → Network Debugging → ON");
    process.exit(1);
  }

  const ip = found[0];
  const port = "5555";

  // Save to config
  saveConfig(ip, port);
  console.log(`✅ Found TV at ${ip} — saved to ~/.clawtv/config.json`);

  // Connect via adb and verify
  const connectOut = adbRaw(`connect ${ip}:${port}`);
  const connectOk =
    connectOut.includes("connected to") || connectOut.includes("already connected");
  if (connectOk) {
    console.log(`✅ ADB connected to ${ip}:${port}`);
  } else {
    console.error(`⚠️  ADB connect failed: ${connectOut.trim()}`);
    console.error(
      "   The TV was found on the network but ADB could not connect.",
    );
    console.error(
      "   Check that 'Network debugging' is enabled in Developer Options.",
    );
    console.error("   You may need to accept the debug prompt on the TV.");
  }

  if (found.length > 1) {
    console.log(`\nAlso found: ${found.slice(1).join(", ")}`);
    console.log(`To use a different one, edit ~/.clawtv/config.json`);
  }

  if (connectOk) {
    console.log(`\nYou're good to go. Try: clawtv screenshot`);
  }
}

function cmdScreenshot() {
  ensureConnected();
  // Remove stale screenshot so we can detect failure
  if (fs.existsSync(SCREEN_PATH)) fs.unlinkSync(SCREEN_PATH);

  const capResult = adb("shell screencap -p /sdcard/_clawtv.png");
  const pullResult = adb(`pull /sdcard/_clawtv.png "${SCREEN_PATH}"`);
  if (!fs.existsSync(SCREEN_PATH)) {
    console.error("❌ Screenshot failed — file was not created.");
    console.error(`   screencap: ${capResult.trim()}`);
    console.error(`   pull: ${pullResult.trim()}`);
    console.error("   Is the TV connected? Try: clawtv setup");
    process.exit(1);
  }
  const size = fs.statSync(SCREEN_PATH).size;
  console.log(`Screenshot saved: ${SCREEN_PATH}`);
  console.log(`Size: ${size} bytes`);
  // Print path so Claude Code knows where to read it
  console.log(`View: ${SCREEN_PATH}`);
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function cmdPress(args) {
  const key = (args[0] || "select").toLowerCase().replace(/\s+/g, "_");
  const times = parseInt(args[1] || "1", 10);
  const code = KEY_MAP[key] !== undefined ? KEY_MAP[key] : key;
  for (let i = 0; i < times; i++) {
    adb(`shell input keyevent ${code}`);
    if (times > 1 && i < times - 1) sleepSync(150);
  }
  console.log(`Pressed ${key} ×${times}`);
}

function cmdLaunch(args) {
  const appName = args.join(" ").toLowerCase().trim();
  if (appName === "home") {
    adb("shell input keyevent 3");
    console.log("Went home");
    return;
  }
  const known = KNOWN_APPS[appName];
  if (known) {
    const activity = known.activity || resolveActivity(known.pkg);
    if (activity) {
      const out = adb(`shell am start -n ${activity}`);
      console.log(out.trim() || `Launched ${appName}`);
    } else {
      const out = adb(
        `shell am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -p ${known.pkg}`,
      );
      console.log(out.trim() || `Launched ${appName}`);
    }
  } else {
    // Treat as package name directly
    const activity = resolveActivity(appName);
    if (activity) {
      const out = adb(`shell am start -n ${activity}`);
      console.log(out.trim() || `Launched ${appName}`);
    } else {
      console.log(`Unknown app: ${appName}. Try the full package name.`);
    }
  }
}

function cmdType(args) {
  const text = args
    .join(" ")
    .replace(/ /g, "%s")
    .replace(/'/g, "\\'")
    .replace(/&/g, "\\&")
    .replace(/;/g, "\\;");
  adb(`shell input text '${text}'`);
  console.log(`Typed: ${args.join(" ")}`);
}

function cmdVolume(args) {
  const action = (args[0] || "up").toLowerCase();
  const steps = parseInt(args[1] || "3", 10);
  if (action === "mute") {
    adb("shell input keyevent 164");
    console.log("Muted");
    return;
  }
  const key = action === "up" ? 24 : 25;
  for (let i = 0; i < steps; i++) {
    adb(`shell input keyevent ${key}`);
    if (i < steps - 1) sleepSync(100);
  }
  console.log(`Volume ${action} ×${steps}`);
}

function cmdPower(args) {
  const action = (args[0] || "toggle").toLowerCase();
  const key = { on: 224, off: 223, toggle: 26 }[action] || 26;
  adb(`shell input keyevent ${key}`);
  console.log(`Power: ${action}`);
}

function cmdWait(args) {
  const secs = parseFloat(args[0] || "1.5");
  sleepSync(Math.round(secs * 1000));
  console.log(`Waited ${secs}s`);
}

function cmdState() {
  const focus = adb(
    "shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' | head -5",
  );
  const media = adb(
    "shell dumpsys media_session | grep -A3 'state=' | head -20",
  );
  console.log("=== Current focus ===");
  console.log(focus.trim() || "unknown");
  console.log("=== Media state ===");
  console.log(media.trim() || "unknown");
}

function cmdHelp() {
  console.log(`
clawtv — Control your Android TV with Claude Code

Commands:
  clawtv setup                   Auto-find your TV and save config
  clawtv scan                    Find TVs on the network (discovery only)
  clawtv connect                 Connect via ADB
  clawtv screenshot              Capture TV screen → ~/.clawtv/screen.png
  clawtv press <key> [times]     Send remote button press
  clawtv launch <app>            Open an app
  clawtv type "<text>"           Type into a text field
  clawtv volume <up|down|mute>   Adjust volume
  clawtv power <on|off|toggle>   Power control
  clawtv push <file> [dest]      Push file to TV
  clawtv wait [seconds]          Wait for TV to load
  clawtv state                   Show current app + media info

Key names:
  up down left right select back home
  play pause playpause stop next previous rewind fastforward
  volume_up volume_down mute power sleep wake

Known apps:
  apple tv  netflix  youtube  hulu  disney+  max  amazon  prime
  plex  spotify  peacock  paramount  settings  home

Setup:
  npm install -g clawtv
  clawtv setup                   # auto-finds and saves your TV

Docs: https://github.com/phatstraw/clawtv
`);
}

function cmdPush(args) {
  if (args.length === 0) {
    console.error("Usage: clawtv push <local_path> [remote_path]");
    console.error("  Default remote path: /sdcard/Download/");
    process.exit(1);
  }
  ensureConnected();
  const localPath = args[0];
  const remotePath = args[1] || "/sdcard/Download/";
  if (!fs.existsSync(localPath)) {
    console.error(`❌ File not found: ${localPath}`);
    process.exit(1);
  }
  const out = adb(`push "${localPath}" "${remotePath}"`);
  if (out.includes("error") || out.includes("failed")) {
    console.error(`❌ Push failed: ${out.trim()}`);
    process.exit(1);
  }
  console.log(`Pushed ${localPath} → ${remotePath}`);
  console.log(out.trim());
}

// ── Router ─────────────────────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;

const COMMANDS = {
  setup: () => cmdSetup(),
  scan: () => cmdScan(),
  connect: () => cmdConnect(),
  screenshot: () => cmdScreenshot(),
  screen: () => cmdScreenshot(),
  press: () => cmdPress(args),
  launch: () => cmdLaunch(args),
  open: () => cmdLaunch(args),
  type: () => cmdType(args),
  text: () => cmdType(args),
  volume: () => cmdVolume(args),
  vol: () => cmdVolume(args),
  power: () => cmdPower(args),
  push: () => cmdPush(args),
  wait: () => cmdWait(args),
  state: () => cmdState(),
  status: () => cmdState(),
  help: () => cmdHelp(),
};

async function main() {
  if (!cmd || cmd === "--help" || cmd === "-h") {
    cmdHelp();
  } else if (COMMANDS[cmd.toLowerCase()]) {
    await COMMANDS[cmd.toLowerCase()]();
  } else {
    console.error(`Unknown command: ${cmd}`);
    console.error(`Run 'clawtv help' for usage.`);
    process.exit(1);
  }
}

// Only run CLI when executed directly (not when required for testing)
if (require.main === module) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}

// ── Exports for testing ───────────────────────────────────────────────────
module.exports = {
  loadConfig,
  saveConfig,
  getLocalSubnet,
  getTarget,
  resolveActivity,
  ensureConnected,
  fastScan,
  sleep,
  sleepSync,
  adb,
  adbRaw,
  cmdConnect,
  cmdScan,
  cmdSetup,
  cmdScreenshot,
  cmdPress,
  cmdLaunch,
  cmdType,
  cmdVolume,
  cmdPower,
  cmdWait,
  cmdState,
  cmdPush,
  cmdHelp,
  KEY_MAP,
  KNOWN_APPS,
  COMMANDS,
  CONFIG_DIR,
  CONFIG_FILE,
  SCREEN_PATH,
  TV_IP,
  TV_PORT,
};
