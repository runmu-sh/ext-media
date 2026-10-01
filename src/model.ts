/**
 * The pure parts of the Media panel: copy, CSS, the view helpers and the per-session watcher that auto-adds
 * the panel. Nothing here imports `vue` or touches the DOM, so tests run it under plain Node.
 */
import type { Dispose, MediaImageView, MediaTrackView, MediaView, Mu } from '@muclient/sdk';

/** Copy, from μClient's world-panels/copy.ts `media` (sentence case; CSS uppercases). */
export const COPY = {
  title: 'Media',
  nowPlaying: 'Now playing',
  nothing: 'Nothing playing',
  images: 'Images',
  noImages: 'No images',
  clear: 'Clear',
  stopLabel: 'Stop',
  stop: (name: string) => `stop ${name}`,
  volume: 'volume',
  vol: 'Vol',
  blocked: 'click anywhere to allow audio',
  open: 'open media',
};

/** Tokens only (R-ARCH-7). Every rule is under `.mu-media`. Ported from MediaPanel.vue's scoped CSS. */
export const MEDIA_CSS = `
.mu-media { height: 100%; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg-elev); box-sizing: border-box; }
.mu-media .np { flex: none; border-bottom: 1px solid var(--accent); }
.mu-media .hd { display: flex; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--border); }
.mu-media .tag { font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-bright); }
.mu-media .x { margin-left: auto; }
.mu-media .tracks { list-style: none; margin: 0; padding: 8px 10px 0; display: flex; flex-direction: column; gap: 4px; font-size: .78rem; }
.mu-media .tracks li { display: flex; align-items: center; gap: 8px; }
.mu-media .g { color: var(--accent); }
.mu-media .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gold); }
.mu-media .k { font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; color: var(--fg-faint); }
.mu-media .empty { margin: 0; padding: 10px; color: var(--fg-faint); font-style: normal; font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; }
.mu-media .blocked { padding-top: 0; color: var(--gold); }
.mu-media .vol { display: flex; align-items: center; gap: 8px; padding: 6px 10px 9px; }
.mu-media .vol .rng { flex: 1; max-width: none; }
.mu-media .vglyph { color: var(--fg-dim); font-size: .62rem; letter-spacing: .16em; text-transform: uppercase; transition: color .12s ease; }
.mu-media .vglyph.muted { color: var(--fg-faint); text-decoration: line-through; }
.mu-media .vval { min-width: 2em; text-align: right; font-size: .72rem; color: var(--fg-dim); }
.mu-media .gallery { flex: 1; }
.mu-media .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 5px; padding: 8px 10px; }
.mu-media .thumb { display: block; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--border-bright); background: var(--bg); transition: border-color .12s ease; }
.mu-media .thumb:hover { border-color: var(--accent); }
.mu-media .thumb:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }
.mu-media .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

/** The music first, then the sounds. */
export function tracksOf(m: Pick<MediaView, 'music' | 'sounds'> | null): MediaTrackView[] {
  return m ? [...(m.music ? [m.music] : []), ...m.sounds] : [];
}

/** The title shown for a track: the host's `title`, else the file name without folder or extension. */
export function titleOf(t: Pick<MediaTrackView, 'title' | 'name'>): string {
  if (t.title) return t.title;
  return (t.name.split('/').pop() || t.name).replace(/\.[a-z0-9]{2,4}$/i, '');
}

/** The master volume (0–1) as a whole percentage, clamped to 0–100. */
export function pctOf(volume: number): number {
  const v = Math.round(Number(volume) * 100);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
}

/** The `setOutput` patch for a slider value: moving it off 0 unmutes. */
export function volumePatch(pct: number, muted: boolean): { volume: number; muted?: boolean } {
  const p = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
  return p > 0 && muted ? { volume: p / 100, muted: false } : { volume: p / 100 };
}

/** The VOL label is struck through when muted or at 0. */
export const isStruck = (muted: boolean, pct: number): boolean => muted || pct === 0;

/** The value beside the slider: `—` when muted, else `NN%`. */
export const volumeText = (muted: boolean, pct: number): string => (muted ? '—' : `${pct}%`);

/** The hover title and alt of a thumbnail. */
export const imageTitle = (i: Pick<MediaImageView, 'url' | 'caption'>): string => i.caption || i.url;

/** Something plays or an image is shown: what auto-adds the panel. */
export function hasMedia(m: MediaView | null): boolean {
  return !!m && (!!m.music || m.sounds.length > 0 || m.images.length > 0);
}

/**
 * Watch every session's media (sessions from `mu.sessions.list()`, re-read on `switch` and on a line from a
 * session not seen yet) and call
 * `mu.panels.autoAdd(panel, sid)` the first time one plays something or shows an image. A session's watch is
 * disposed once it fired, or when the session went away (checked on every callback too); the returned Dispose
 * ends them all.
 */
export function watchSessions(mu: Pick<Mu, 'media' | 'sessions' | 'panels'>, panel = 'media'): Dispose {
  const watches = new Map<string, Dispose>();
  const added = new Set<string>();
  let live = true;
  const isLive = (sid: string) => mu.sessions.list().some((s) => s.id === sid);
  const stop = (sid: string) => { const off = watches.get(sid); watches.delete(sid); off?.(); };
  const ensure = (sid: string) => {
    if (!live || !sid || added.has(sid) || watches.has(sid)) return;
    let ended = false;
    const end = () => { ended = true; stop(sid); };
    // watch() calls back at once with the media now, before it has returned its dispose: `ended` covers that.
    const off = mu.media.watch((m) => {
      if (ended) return;
      // A session that closed between syncs: stop rather than add a panel for it.
      if (!isLive(sid)) { end(); return; }
      if (!hasMedia(m)) return;
      added.add(sid);
      mu.panels.autoAdd(panel, sid);
      end(); // its job is done: nothing more to watch for this session
    }, sid);
    if (ended) off(); else watches.set(sid, off);
  };
  const sync = () => {
    if (!live) return;
    const ids = new Set(mu.sessions.list().map((s) => s.id));
    for (const sid of [...watches.keys()]) if (!ids.has(sid)) stop(sid);
    for (const sid of [...added]) if (!ids.has(sid)) added.delete(sid);
    for (const sid of ids) ensure(sid);
  };
  const offSwitch = mu.sessions.on('switch', sync);
  // A session opened in the background (no switch) is picked up by its first line.
  const offLine = mu.sessions.on('line', (_l, { sid }) => { if (!watches.has(sid) && !added.has(sid)) sync(); });
  sync();
  return () => {
    live = false;
    offSwitch();
    offLine();
    for (const sid of [...watches.keys()]) stop(sid);
    added.clear();
  };
}
