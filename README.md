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

## GMCP contract
None. The core owns `Client.Media` support (it negotiates the package and plays the cues), so the manifest declares no GMCP package and no payload contract: the extension reads no GMCP message and sends none. It reads the host's media model (`mu.media.watch`) only. It asks for **no capabilities** (since 1.1.0; 1.0 asked for `read-output`).

## What it looks like
Composed as Underspire's media panel, on `--bg-elev`:

- **NOW PLAYING** (an uppercase `--accent-bright` tag; the block has an `--accent` bottom rule). While something plays the head has **[ STOP ]**, which stops everything in the session. One row per track, music first then sounds: `♪`, the title (the file name without folder or extension, in `--gold`; a link to the file in a new tab when it is http(s)), the kind (`music` / `sound`, small faint capitals) and **[ STOP ]**, which stops that track. With nothing playing it says NOTHING PLAYING.
- When the browser blocked autoplay: *click anywhere to allow audio* in `--gold`.
- The volume row: the **VOL** label (struck through and faint when muted or at 0), the host's `.rng` slider (filled to `--p`), and the value as a bare number (`40`), or `—` when muted. The slider is the master volume, the same setting as the ☰ menu's Sound row. Moving it off 0 unmutes.
- **IMAGES** with **[ CLEAR ]** (forgets the session's images) over a grid of 72px thumbnails; each opens the image in a new tab, its caption as the tooltip. With none it says NO IMAGES.

## Behaviour
- Panel `media`, singleton, per session, default position right top, Views order 30 (after Scene and Channels).
- The panel auto-adds on the first track or image seen: the first time a session plays music or a sound, or shows an image, the extension calls `mu.panels.touch` and the panel is added if it is not open, once per world on this device, so a Media panel you closed stays closed. The panel is listed in Views from the start.
- The panel tab's menu (right-click the MEDIA tab) has **Stop all** and **Clear images**; the same two are commands (`media.stop`, `media.clear`, in Ctrl+K and Settings → Keys) while the panel is open.
- The now-playing line under the ☰ menu's Sound row opens the Media panel and focuses it (`mu.menus.add({ slot: 'now-playing' })`, tooltip *open media*). From μClient 1.14 the client leaves this action to the extension; without the extension the line is plain text.
- The settings page (Settings → Extensions → Media) has a **Keys** group with shortcut rows for Stop all media (`keys.stop`) and Clear images (`keys.clear`). They are unbound by default and edit the same entry as Settings → Keys. On hosts before 1.14 the rows are left out.
- Setting **Note new music in the log** (`noteMusic`, off by default, per world): each time the game starts a new piece of music, a `♪ media: <url>` line in the terminal, as Underspire writes.

## SDK and exported API
Needs SDK 1.12 (`api` `^1.12`); on a 1.14 host it also uses `mu.menus.add({ slot: 'now-playing' })` and `kind: 'shortcut'` settings items, both behind a guard (the slot is tried in a try/catch, and the shortcut rows are defined only when it was accepted). Uses `mu.panels.register` / `vue` / `touch`, `mu.sessions.each` / `active` / `echo`, `mu.media.watch` / `stop` / `clearImages` / `setOutput`, `mu.settings.define` / `get`, `mu.commands.register` (`when: 'panel:media'`), `mu.menus.add` (`slot: 'panel:media'`, and `'now-playing'` on 1.14) and `mu.ui.style` (every rule under `.ext-panel[data-ext="media"]`).

It exports no runtime API to other extensions (`activate` returns nothing). The module's named exports are kept compatible: `COPY`, `MEDIA_CSS`, `tracksOf`, `titleOf`, `pctOf`, `volumePatch`, `isStruck`, `volumeText`, `imageTitle`, `hasMedia`, `watchSessions` (deprecated, unused by the extension) and, new in 1.1, `volumeValue`, `linkOf`, `step` and the types `SessionState`, `MediaSettings` (`src/types.ts`). `MEDIA_CSS` is now scoped under `.ext-panel[data-ext="media"] .mu-media`.

## Develop
Made with `npm create @runmu.sh/extension` ([the quickstart](https://runmu.sh/docs/extensions/quickstart)).

```sh
npm install
npm run build        # src/index.ts → dist/index.js, then the manifest check
npm run typecheck    # tsc --noEmit against @runmu.sh/sdk
npm test             # unit tests + the headless host (@runmu.sh/dev/test)
npm run dev          # dev server on http://localhost:5199/ with hot reload
```

In μClient: **☰ → Extensions → Advanced → Developer → load from dev server**.

## License
MIT
