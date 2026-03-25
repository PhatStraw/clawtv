---
name: clawtv
description: Control any Android TV with ADB — launch apps, navigate UI, find shows, and manage playback via the clawtv CLI
triggers:
  - watch
  - tv
  - television
  - netflix
  - hulu
  - apple tv
  - disney+
  - youtube
  - put on
  - play on tv
  - find on tv
  - volume
  - remote
  - android tv
---

# clawtv skill

You can control any Android TV using the `clawtv` CLI.

## When to use this skill
Use this skill whenever the user wants to:
- Watch something on TV ("put on X", "find Y", "play Z")
- Control their TV ("turn it off", "volume up", "pause")
- Navigate to an app ("open Netflix", "go to Apple TV")
- Have something ready when they get home ("queue up X for tonight")

## Core loop
1. **Screenshot first** — always run `clawtv screenshot` before acting so you can see the current state
2. **Read the screen** — open `~/.clawtv/screen.png` to see what's on the TV
3. **Plan** — decide the steps needed to reach the goal
4. **Execute** — run clawtv commands one at a time
5. **Verify** — screenshot after key navigation steps to confirm progress
6. **Recover** — if lost, `clawtv press back` or `clawtv press home` to reorient

## All commands

```bash
clawtv screenshot              # Capture screen → ~/.clawtv/screen.png (READ THIS after every navigation)
clawtv press <key> [times]     # Remote button
clawtv launch <app>            # Open app by name
clawtv type "<text>"           # Type into search field
clawtv volume <up|down|mute> [steps]
clawtv power <on|off|toggle>
clawtv wait [seconds]          # Wait for app/animation to load
clawtv state                   # Current app + playback info
clawtv connect                 # Reconnect if ADB dropped
```

### Key names for `clawtv press`
`up` `down` `left` `right` `select` `back` `home`
`play` `pause` `playpause` `stop` `next` `previous` `rewind` `fastforward`
`volume_up` `volume_down` `mute` `power` `sleep` `wake`

### App names for `clawtv launch`
`apple tv` `netflix` `youtube` `hulu` `disney+` `max` `amazon` `prime`
`plex` `spotify` `peacock` `paramount` `settings` `home`

## Navigation patterns

### Opening an app and searching for a show
```bash
clawtv launch netflix
clawtv wait 3
clawtv screenshot              # See home screen
clawtv press up                # Move to top nav
clawtv press select            # Open search
clawtv wait 1
clawtv type "the bear"
clawtv wait 2
clawtv screenshot              # See search results
clawtv press down              # Move into results
clawtv press select            # Select show
clawtv screenshot              # Confirm show page
```

### Finding continue watching
```bash
clawtv launch "apple tv"
clawtv wait 3
clawtv screenshot              # See home screen
# Continue Watching is usually 1-2 rows down from top
clawtv press down
clawtv screenshot              # Check if we're on the right row
# Navigate right to find the specific show
clawtv press right [times]
clawtv screenshot
clawtv press select            # Resume
```

### Navigating Apple TV top bar
The top nav in Apple TV has: Search (magnifier) | Home | Library | Store
- Navigate with `left`/`right` while focused on top bar
- Press `up` from content to reach the top bar
- Press `select` to enter a section

### If the screen is black / TV asleep
```bash
clawtv power on
clawtv wait 2
clawtv screenshot
```

### If ADB disconnects
```bash
clawtv connect
clawtv screenshot
```

## Tips
- After `clawtv launch`, always `clawtv wait 2.5` before the next action — apps need time to load
- After `clawtv type`, wait 1-2s for search results to populate before pressing down
- Don't spam navigation — screenshot every 3-4 presses to check position
- If a row isn't responding to `right`, try `down` first to focus the row, then `right`
- "Continue Watching" rows prioritize the most recently watched — the show is usually within 1-3 rights
- For text input on Apple TV: navigate to the search icon, press select, THEN type (the keyboard needs to be active)
