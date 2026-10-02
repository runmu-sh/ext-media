# Changelog

## 1.1.0

- **[ STOP ]** in the Now Playing header stops everything at once, as on Underspire. Each track keeps its own Stop.
- A track's title links to the file when it has a web address.
- The volume shows a bare number (`40`) beside the slider, as on Underspire.
- Right-click the Media tab for **Stop all** and **Clear images**; both are also in Ctrl+K and can be bound to keys while the panel is open.
- New setting **Note new music in the log** (off by default): a `♪ media: <link>` line when the game starts new music.
- Asks for no permissions any more (it no longer reads game output), and follows sessions opened in the background more reliably.
- Needs μClient with extension API 1.12.

## 1.0.0

- The Media panel as an extension. It was part of the μClient core (`MediaPanel.vue`); it now draws each session's media through `mu.media.watch` and drives it through `mu.media.stop`, `clearImages` and `setOutput` (SDK 1.7). The host still plays every cue and keeps the images and the master volume. Panel id `media`, its copy and its `data-testid`s are unchanged, so saved layouts and selectors keep working.
- The panel is added to a session's workspace the first time it plays something or shows an image (once per world on this device).
