#!/usr/bin/env node
/**
 * clawtv — ADB tool executor for Claude Code
 * https://github.com/YOUR_USERNAME/clawtv
 *
 * Claude Code reads the skill and calls this CLI directly.
 * No API keys. No config files. Just ADB + Claude Code.
 *
 * Commands:
 *   clawtv screenshot
 *   clawtv press <key> [times]
 *   clawtv launch <app>
 *   clawtv type "<text>"
 *   clawtv volume <up|down|mute> [steps]
 *   clawtv power <on|off|toggle>
 *   clawtv push <local_path> [remote_path]
 *   clawtv wait [seconds]
 *   clawtv state
 *   clawtv connect
 *   clawtv scan              ← finds your TV on the network
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ── Config ─────────────────────────────────────────────────────────────────
const TV_IP   = process.env.CLAWTV_IP   || process.env.TV_IP   || null;
const TV_PORT = process.env.CLAWTV_PORT || process.env.TV_PORT || "5555";
const SCREEN_PATH = path.join(os.homedir(), ".clawtv", "screen.png");

// Ensure ~/.clawtv dir exists
fs.mkdirSync(path.dirname(SCREEN_PATH), { recursive: true });

// ── Known apps ─────────────────────────────────────────────────────────────
const KNOWN_APPS = {
  "apple tv":    { pkg: "com.apple.atve.androidtv.appletv",       activity: "com.apple.atve.androidtv.appletv/.MainActivity" },
  "netflix":     { pkg: "com.netflix.ninja",                       activity: "com.netflix.ninja/.MainActivity" },
  "youtube":     { pkg: "com.google.android.youtube.tv",           activity: "com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity" },
  "hulu":        { pkg: "com.hulu.livingroom",                     activity: null },
  "disney+":     { pkg: "com.disney.disneyplus",                   activity: null },
  "disney plus": { pkg: "com.disney.disneyplus",                   activity: null },
  "max":         { pkg: "com.hbo.hbonow",                          activity: null },
  "hbo":         { pkg: "com.hbo.hbonow",                          activity: null },
  "amazon":      { pkg: "com.amazon.amazonvideo.livingroom",        activity: null },
  "prime":       { pkg: "com.amazon.amazonvideo.livingroom",        activity: null },
  "plex":        { pkg: "com.plexapp.android",                     activity: null },
  "spotify":     { pkg: "com.spotify.tv.android",                  activity: null },
  "peacock":     { pkg: "com.peacocktv.peacockandroid",            activity: null },
  "paramount":   { pkg: "com.cbs.ott",                             activity: null },
  "settings":    { pkg: "com.android.tv.settings",                 activity: null },
};

const KEY_MAP = {
  up: 19, down: 20, left: 21, right: 22,
  select: 23, enter: 23, ok: 23,
  back: 4, home: 3, menu: 82,
  play: 85, pause: 85, playpause: 85,
  stop: 86, next: 87, previous: 88,
  rewind: 89, fastforward: 90,
  volume_up: 24, volume_down: 25, mute: 164,
  power: 26, sleep: 223, wake: 224,
};

// ── ADB helpers ────────────────────────────────────────────────────────────
function getTarget() {
  if (!TV_IP) {
    // Try to find a connected device automatically
    const out = adbRaw("devices");
    const lines = out.split("\n").filter(l => l.includes(":5555") && l.includes("device"));
    if (lines.length > 0) {
      return lines[0].split("\t")[0].trim();
    }
    console.error("❌ No TV found. Set CLAWTV_IP or run: clawtv scan");
    process.exit(1);
  }
  return `${TV_IP}:${TV_PORT}`;
}

function adbRaw(cmd) {
  try {
    return execSync(`adb ${cmd}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function adb(cmd) {
  const target = getTarget();
  try {
    return execSync(`adb -s ${target} ${cmd}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function resolveActivity(pkg) {
  const out = adb(`shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER ${pkg}`);
  for (const line of out.split("\n")) {
    if (line.includes("/") && !line.startsWith("priority")) return line.trim();
  }
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Commands ───────────────────────────────────────────────────────────────
function cmdConnect() {
  if (!TV_IP) {
    console.log("No CLAWTV_IP set. Run: clawtv scan");
    return;
  }
  const target = `${TV_IP}:${TV_PORT}`;
  console.log(`Connecting to ${target}...`);
  const out = adbRaw(`connect ${target}`);
  console.log(out.trim());
}

function cmdScan() {
  console.log("Scanning network for Android TV devices on port 5555...");
  // Get local subnet
  try {
    const ifaces = os.networkInterfaces();
    const subnets = [];
    for (const iface of Object.values(ifaces)) {
      for (const addr of iface) {
        if (addr.family === "IPv4" && !addr.internal) {
          const parts = addr.address.split(".");
          subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
    if (subnets.length === 0) {
      console.log("Could not determine local subnet.");
      return;
    }
    const subnet = subnets[0];
    console.log(`Scanning ${subnet}.0/24 ...`);
    // Quick port scan using adb connect attempts (fast)
    const found = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${subnet}.${i}`;
      const out = adbRaw(`connect ${ip}:5555`);
      if (out.includes("connected") && !out.includes("failed") && !out.includes("refused")) {
        console.log(`✅ Found TV at: ${ip}`);
        found.push(ip);
      }
    }
    if (found.length === 0) {
      console.log("No devices found. Make sure ADB debugging is enabled on your TV.");
      console.log("Settings → Developer Options → Network Debugging → ON");
    } else {
      console.log(`\nAdd to your shell profile:`);
      console.log(`  export CLAWTV_IP=${found[0]}`);
    }
  } catch (e) {
    console.error("Scan error:", e.message);
  }
}

function cmdScreenshot() {
  adb("shell screencap -p /sdcard/_clawtv.png");
  adb(`pull /sdcard/_clawtv.png "${SCREEN_PATH}"`);
  const size = fs.statSync(SCREEN_PATH).size;
  console.log(`Screenshot saved: ${SCREEN_PATH}`);
  console.log(`Size: ${size} bytes`);
  // Print path so Claude Code knows where to read it
  console.log(`View: ${SCREEN_PATH}`);
}

function cmdPress(args) {
  const key   = (args[0] || "select").toLowerCase().replace(/\s+/g, "_");
  const times = parseInt(args[1] || "1", 10);
  const code  = KEY_MAP[key] !== undefined ? KEY_MAP[key] : key;
  for (let i = 0; i < times; i++) {
    adb(`shell input keyevent ${code}`);
    if (times > 1 && i < times - 1) execSync("sleep 0.15");
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
      const out = adb(`shell am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -p ${known.pkg}`);
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
  const text = args.join(" ")
    .replace(/ /g, "%s")
    .replace(/'/g, "\\'")
    .replace(/&/g, "\\&")
    .replace(/;/g, "\\;");
  adb(`shell input text '${text}'`);
  console.log(`Typed: ${args.join(" ")}`);
}

function cmdVolume(args) {
  const action = (args[0] || "up").toLowerCase();
  const steps  = parseInt(args[1] || "3", 10);
  if (action === "mute") {
    adb("shell input keyevent 164");
    console.log("Muted");
    return;
  }
  const key = action === "up" ? 24 : 25;
  for (let i = 0; i < steps; i++) {
    adb(`shell input keyevent ${key}`);
    if (i < steps - 1) execSync("sleep 0.1");
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
  execSync(`sleep ${secs}`);
  console.log(`Waited ${secs}s`);
}

function cmdState() {
  const focus = adb("shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' | head -5");
  const media = adb("shell dumpsys media_session | grep -A3 'state=' | head -20");
  console.log("=== Current focus ===");
  console.log(focus.trim() || "unknown");
  console.log("=== Media state ===");
  console.log(media.trim() || "unknown");
}

function cmdHelp() {
  console.log(`
clawtv — Control your Android TV with Claude Code

Commands:
  clawtv scan                    Find your TV on the network
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
  export CLAWTV_IP=<your-tv-ip>    (add to ~/.zshrc)

Docs: https://github.com/YOUR_USERNAME/clawtv
`);
}

// ── Router ─────────────────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

const COMMANDS = {
  scan:       () => cmdScan(),
  connect:    () => cmdConnect(),
  screenshot: () => cmdScreenshot(),
  screen:     () => cmdScreenshot(),
  press:      () => cmdPress(args),
  launch:     () => cmdLaunch(args),
  open:       () => cmdLaunch(args),
  type:       () => cmdType(args),
  text:       () => cmdType(args),
  volume:     () => cmdVolume(args),
  vol:        () => cmdVolume(args),
  power:      () => cmdPower(args),
  push:       () => { /* TODO: implement push in node */ console.log("Use: adb push <file> /sdcard/Movies/"); },
  wait:       () => cmdWait(args),
  state:      () => cmdState(),
  status:     () => cmdState(),
  help:       () => cmdHelp(),
};

if (!cmd || cmd === "--help" || cmd === "-h") {
  cmdHelp();
} else if (COMMANDS[cmd.toLowerCase()]) {
  COMMANDS[cmd.toLowerCase()]();
} else {
  console.error(`Unknown command: ${cmd}`);
  console.error(`Run 'clawtv help' for usage.`);
  process.exit(1);
}
