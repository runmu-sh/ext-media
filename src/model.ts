/**
 * The pure parts of the Media panel: copy, CSS, the view helpers and the per-session step (touch + note). Nothing here imports `vue` or touches the DOM, so tests run it under plain Node.
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
  /** The header [ STOP ] (Underspire's): stops everything the session plays. @since 1.1.0 */
  stopAll: 'stop',
  /** The gallery's [ CLEAR ] aria-label (Underspire's). @since 1.1.0 */
  clearLabel: 'clear',
  /** The log note when new music starts (Underspire's media note). @since 1.1.0 */
  note: (url: string) => `♪ media: ${url}`,
  /** The setting that turns the note on. @since 1.1.0 */
  noteSetting: 'Note new music in the log',
  noteHint: 'A ♪ media line with the link, each time the game starts a new piece of music',
};

/**
 * Tokens only (R-ARCH-7). Every rule is under `.ext-panel[data-ext="media"] .mu-media` (the host's panel wrapper,
 * then the panel root). Ported from MediaPanel.vue's scoped CSS; the values are Underspire's `.media-panel`.
 */
export const MEDIA_CSS = `
.ext-panel[data-ext="media"] .mu-media { height: 100%; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg-elev); box-sizing: border-box; }
.ext-panel[data-ext="media"] .mu-media .np { flex: none; border-bottom: 1px solid var(--accent); }
.ext-panel[data-ext="media"] .mu-media .hd { display: flex; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--border); }
.ext-panel[data-ext="media"] .mu-media .tag { font-size: .72rem; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-bright); }
.ext-panel[data-ext="media"] .mu-media .x { margin-left: auto; }
.ext-panel[data-ext="media"] .mu-media .tracks { list-style: none; margin: 0; padding: 8px 10px 0; display: flex; flex-direction: column; gap: 4px; font-size: .78rem; }
.ext-panel[data-ext="media"] .mu-media .tracks li { display: flex; align-items: center; gap: 8px; }
.ext-panel[data-ext="media"] .mu-media .g { color: var(--accent); }
.ext-panel[data-ext="media"] .mu-media .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--gold); }
.ext-panel[data-ext="media"] .mu-media .k { font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; color: var(--fg-faint); }
.ext-panel[data-ext="media"] .mu-media .empty { margin: 0; padding: 10px; color: var(--fg-faint); font-style: normal; font-size: .64rem; letter-spacing: .14em; text-transform: uppercase; }
.ext-panel[data-ext="media"] .mu-media .blocked { padding-top: 0; color: var(--gold); }
.ext-panel[data-ext="media"] .mu-media .vol { display: flex; align-items: center; gap: 8px; padding: 6px 10px 9px; }
.ext-panel[data-ext="media"] .mu-media .vol .rng { flex: 1; max-width: none; }
.ext-panel[data-ext="media"] .mu-media .vglyph { color: var(--fg-dim); font-size: .62rem; letter-spacing: .16em; text-transform: uppercase; transition: color .12s ease; }
.ext-panel[data-ext="media"] .mu-media .vglyph.muted { color: var(--fg-faint); text-decoration: line-through; }
.ext-panel[data-ext="media"] .mu-media .vval { min-width: 2em; text-align: right; font-size: .72rem; color: var(--fg-dim); }
.ext-panel[data-ext="media"] .mu-media .gallery { flex: 1; }
.ext-panel[data-ext="media"] .mu-media .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 5px; padding: 8px 10px; }
.ext-panel[data-ext="media"] .mu-media .thumb { display: block; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--border-bright); background: var(--bg); transition: border-color .12s ease; }
.ext-panel[data-ext="media"] .mu-media .thumb:hover { border-color: var(--accent); }
.ext-panel[data-ext="media"] .mu-media .thumb:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: -2px; }
.ext-panel[data-ext="media"] .mu-media .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ext-panel[data-ext="media"] .mu-media a.t { text-decoration: none; }
.ext-panel[data-ext="media"] .mu-media a.t:hover, .ext-panel[data-ext="media"] .mu-media a.t:focus-visible { text-decoration: underline; color: var(--accent-bright); }
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

/** The value beside the slider: `—` when muted, else `NN%`. Kept for callers; the panel shows {@link volumeValue}. */
export const volumeText = (muted: boolean, pct: number): string => (muted ? '—' : `${pct}%`);

/** The value beside the slider as Underspire shows it: the bare number, or `—` when muted. @since 1.1.0 */
export const volumeValue = (muted: boolean, pct: number): string => (muted ? '—' : String(pct));

/** A link the panel may open: http(s) only (a track's URL as Underspire's now-playing link). @since 1.1.0 */
export const linkOf = (url: string | undefined): string | null => (typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null);

/** The hover title and alt of a thumbnail. */
export const imageTitle = (i: Pick<MediaImageView, 'url' | 'caption'>): string => i.caption || i.url;

/** Something plays or an image is shown: what auto-adds the panel. */
export function hasMedia(m: MediaView | null): boolean {
  return !!m && (!!m.music || m.sounds.length > 0 || m.images.length > 0);
}

import type { SessionState } from './types.ts';
export type { SessionState } from './types.ts';

/**
 * One media update for a session: whether to touch the panel (data arrived for it the first time) and the
 * log note to write for music that started since the last update. The first update only seeds the music (a
 * session that was already playing when the extension activated gets no note). @since 1.1.0
 */
export function step(st: SessionState, m: MediaView | null): { touch: boolean; note: string | null } {
  const touch = !st.touched && hasMedia(m);
  if (touch) st.touched = true;
  const music = m?.music ? `${m.music.key}\u0000${m.music.url}` : null;
  let note: string | null = null;
  if (st.seeded && music && music !== st.music) {
    const url = linkOf(m!.music!.url);
    if (url) note = COPY.note(url);
  }
  st.music = music;
  st.seeded = true;
  return { touch, note };
}

/**
 * Watch every session's media (sessions from `mu.sessions.list()`, re-read on `switch` and on a line from a
 * session not seen yet) and call
 * `mu.panels.autoAdd(panel, sid)` the first time one plays something or shows an image.
 A session's watch is disposed once it fired, or when the session went away (checked on every
 * callback too); the returned Dispose ends them all.
 * @deprecated since 1.1.0: the extension itself uses `mu.sessions.each` + `mu.panels.touch` (no `read-output`);
 * this stays exported, unchanged, for compatibility.
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
