# clawtv 🦞📺

**Stop Googling what app your show is on.**

Tell Claude what you want to watch before you leave the house. Walk in, press play.

```bash
> find palm beach royale on apple tv and have it ready to play
```

*Claude takes a screenshot of your TV, navigates to Apple TV, finds the show, and pauses on the play button. You walk in and press select.*

---

## How it works

clawtv is two things:

1. **An npm CLI** that wraps ADB — giving Claude Code a clean set of tools to control any Android TV over your local network
2. **A Claude Code skill** that teaches Claude *how* to navigate TV interfaces autonomously — taking screenshots, reading the screen, and executing until the goal is done

No API keys. No cloud. No subscription. Just Claude Code + your TV on the same WiFi.

---

## Requirements

- [Claude Code](https://claude.ai/code) installed
- An Android TV (TCL, Sony, Hisense, Chromecast with Google TV, etc.)
- ADB debugging enabled on your TV
- Node.js 18+
- `adb` installed (`brew install android-platform-tools` on Mac)

---

## Install

**Step 1 — Install the CLI:**
```bash
npm install -g clawtv
```

**Step 2 — Find and save your TV (one time):**
```bash
clawtv setup          # auto-finds your TV and saves to ~/.clawtv/config.json
```

**Step 3 — Install the skill in Claude Code:**
```bash
npx skills add phatstraw/clawtv
```

**Step 4 — Start Claude Code in any directory and talk to your TV:**
```bash
claude
```

---

## Examples

```
> put on the latest episode of the bear on hulu
> find inception on netflix and pause on the play button
> open youtube and search for lofi hip hop
> turn the tv off
> volume up
> go back to the home screen
```

---

## Enable ADB on your TV

1. **Settings → About → Android TV OS Build** — tap 7 times rapidly
2. You'll see *"You are now a developer"*
3. **Settings → Developer Options → Network Debugging → ON**
4. Run `clawtv setup` to find and save your TV's IP

---

## How the demo works

The demo video uses [scrcpy](https://github.com/Genymobile/scrcpy) to mirror the TV screen live to the Mac:

```bash
brew install scrcpy
scrcpy --tcpip=<your-tv-ip>:5555
```

Split your screen: scrcpy on the left, Claude Code terminal on the right. Type your goal. Watch Claude navigate your TV in real time.

---

## Supported apps

`apple tv` `netflix` `youtube` `hulu` `disney+` `max` `amazon` `prime` `plex` `spotify` `peacock` `paramount`

Any other app can be launched by Android package name.

---

## Adding your own apps

```bash
# Find the package name
adb -s <tv-ip>:5555 shell pm list packages | grep <appname>

# Then just tell Claude:
> open com.your.app.package
```

---

## Configuration

clawtv looks for your TV in this order:
1. `CLAWTV_IP` / `CLAWTV_PORT` environment variables (override)
2. `~/.clawtv/config.json` (created by `clawtv setup`)

| Variable | Description |
|---|---|
| `CLAWTV_IP` | Your TV's local IP address (overrides config file) |
| `CLAWTV_PORT` | ADB port (default: 5555) |

---

## Contributing

PRs welcome. The skill file (`SKILL.md`) is where the intelligence lives — improvements to navigation patterns, new app support, and edge case handling are all valuable.

---

## License

MIT
