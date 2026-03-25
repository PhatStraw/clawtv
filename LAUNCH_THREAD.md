# clawtv — X launch thread

---

**Tweet 1 (with the split-screen video)**

i got tired of forgetting what app my shows are on

so i gave claude code a tv remote

[VIDEO: split screen — scrcpy TV mirror left, claude code terminal right. type "find palm beach royale on apple tv and have it ready to play". watch claude screenshot the TV, navigate apple tv, find the show, land on the play button.]

---

**Tweet 2**

how it works:

→ clawtv is an npm package that wraps ADB
→ a skill file teaches Claude Code how to navigate TV UIs
→ claude takes screenshots, reads the screen, navigates until the goal is done

no API keys. no cloud. just claude code + your tv on the same wifi

---

**Tweet 3**

install in 2 commands:

npm install -g clawtv

then in claude code:
/skills install https://raw.githubusercontent.com/YOUR_USERNAME/clawtv/main/skill.md

then just talk:
> "find inception on netflix and pause on play"
> "turn the tv off"
> "have yellowstone s3e4 ready for when i get home"

---

**Tweet 4**

the demo setup if you want to record it yourself:

brew install scrcpy android-platform-tools
scrcpy --tcpip=<your-tv-ip>:5555

split screen: scrcpy left, claude code right
type your goal
watch it work in real time

---

**Tweet 5**

works on any android tv:
TCL ✓  Sony ✓  Hisense ✓  Chromecast with Google TV ✓

open source, MIT license
github: https://github.com/YOUR_USERNAME/clawtv

---

## Alternate single-tweet version (for max virality, video only)

gave claude code a tv remote

"find palm beach royale on apple tv and have it ready to play"

[VIDEO]

github: https://github.com/YOUR_USERNAME/clawtv
npm install -g clawtv
