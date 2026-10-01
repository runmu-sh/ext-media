# Changelog

## 1.0.0

- The Media panel as an extension. It was part of the μClient core (`MediaPanel.vue`); it now draws each session's media through `mu.media.watch` and drives it through `mu.media.stop`, `clearImages` and `setOutput` (SDK 1.7). The host still plays every cue and keeps the images and the master volume. Panel id `media`, its copy and its `data-testid`s are unchanged, so saved layouts and selectors keep working.
- The panel is added to a session's workspace the first time it plays something or shows an image (once per world on this device).
