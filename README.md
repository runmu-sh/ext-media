# Media (`@runmu.sh/ext-media`, id `media`)

The Media panel of [μClient](https://runmu.sh) (R-MEDIA): what is playing, the master volume, and the images the game showed.

First-party, on the [marketplace](https://runmu.sh/marketplace/x/media). Install it from **☰ → Extensions → Discover** and enable it per world in **Extensions → Installed**.

Until 2026-10 the panel was part of the client core. The core still plays the audio and keeps each session's images and the master volume; this extension only draws them. Without it, sound still plays and the ☰ menu's Sound row still sets the volume.

## Where the media comes from
The host keeps one media state per session and fills it from:

| Source | What |
|---|---|
| GMCP `Client.Media.Default`, `Client.Media.Play`, `Client.Media.Stop` | Music and sounds (`key`, `name`, `url`, `type`, `volume`, `loops`) |
| MSP `!!SOUND(...)` / `!!MUSIC(...)` | Music and sounds |
| MXP `<image>` | Images (URL and caption), newest last |
| Another extension: `mu.media.play(spec)` / `mu.media.stop(filter)` | Music and sounds |

The core owns `Client.Media` support (it negotiates the package and plays the cues), so the manifest declares no GMCP package. The extension sends nothing to the game; its one capability is `read-output`, because it listens to `mu.sessions.on('line')` to notice a session opened in the background.

## What it looks like
Composed as Underspire's media panel, on `--bg-elev`:

- **NOW PLAYING** (an uppercase `--accent-bright` tag; the block has an `--accent` bottom rule): one row per track, music first then sounds: `♪`, the title (the file name without folder or extension, in `--gold`), the kind (`music` / `sound`, small faint capitals) and **[ STOP ]**, which stops that track. With nothing playing it says NOTHING PLAYING.
- When the browser blocked autoplay: *click anywhere to allow audio* in `--gold`.
- The volume row: the **VOL** label (struck through and faint when muted or at 0), the host's `.rng` slider (filled to `--p`), and the value, or `—` when muted. The slider is the master volume, the same setting as the ☰ menu's Sound row. Moving it off 0 unmutes.
- **IMAGES** with **[ CLEAR ]** (forgets the session's images) over a grid of 72px thumbnails; each opens the image in a new tab, its caption as the tooltip. With none it says NO IMAGES.

## Behaviour
- Panel `media`, singleton, per session, default position right top, Views order 30 (after Scene and Channels).
- The panel auto-adds on the first track or image seen: the first time a session plays music or a sound, or shows an image, the panel is added if it is not open (R-AUTO-PANELS), once per world on this device, so a Media panel you closed stays closed. It watches every open session (`mu.sessions.list()`, re-read on `switch` and on a line from a session it has not seen), and stops watching a session once its panel was added or when the session closes.
- No settings.

## SDK
Uses `mu.panels.register` (with `order`), `mu.panels.vue` (render functions, `h` from the host's Vue), `mu.panels.autoAdd`, `mu.media.watch`, `mu.media.stop`, `mu.media.clearImages`, `mu.media.setOutput` (SDK 1.7), `mu.sessions.list` / `on` and `mu.ui.style`. It exports no API. The pure helpers (`tracksOf`, `titleOf`, `pctOf`, `volumePatch`, `isStruck`, `volumeText`, `hasMedia`, `watchSessions`) are in `src/model.ts` for the tests.

## Develop
Made with `npm create @runmu.sh/extension` ([the quickstart](https://runmu.sh/docs/extensions/quickstart)).

```sh
npm install
npm run build        # src/index.ts → dist/index.js, then the manifest check
npm run typecheck    # tsc --noEmit against @runmu.sh/sdk
npm test             # node --experimental-strip-types --test "tests/*.test.mjs"
npm run dev          # dev server on http://localhost:5199/ with hot reload
```

In μClient: **☰ → Extensions → Advanced → Developer → load from dev server**.

## License
MIT
