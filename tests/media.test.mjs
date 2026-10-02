// The Media panel's pure parts, its per-session auto-add watcher and its render, with a fake `mu`.
//   npm test   (node --experimental-strip-types --test "tests/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  COPY, MEDIA_CSS, hasMedia, imageTitle, isStruck, linkOf, pctOf, step, titleOf, tracksOf, volumePatch, volumeText, volumeValue, watchSessions,
} from '../src/model.ts';
import { createPanel } from '../src/panel.ts';

const track = (kind, key, name, title = '') => ({ key, name, title, url: `https://x/${name}`, kind, volume: 50, loops: 1 });
const view = (over = {}) => ({ music: null, sounds: [], images: [], blocked: false, volume: 0.5, muted: false, ...over });

/** A fake `mu` with sessions, a switch/line event bus, media watches per sid and recorded calls. */
function fakeMu(sids = []) {
  const media = new Map(sids.map((s) => [s, view()]));
  const watchers = new Map(); // sid -> Set<fn>
  const on = { switch: new Set(), line: new Set() };
  const calls = { autoAdd: [], stop: [], clearImages: [], setOutput: [], watch: [], unwatch: [] };
  let sessions = [...sids];
  const mu = {
    sessions: {
      list: () => sessions.map((id) => ({ id, worldId: `w-${id}`, worldName: id, state: 'connected' })),
      on(ev, fn) { on[ev].add(fn); return () => on[ev].delete(fn); },
    },
    media: {
      get: (sid) => media.get(sid) ?? null,
      watch(fn, sid) {
        calls.watch.push(sid);
        if (!watchers.has(sid)) watchers.set(sid, new Set());
        watchers.get(sid).add(fn);
        fn(media.get(sid) ?? view());
        return () => { calls.unwatch.push(sid); watchers.get(sid)?.delete(fn); };
      },
      stop: (f, sid) => calls.stop.push([f, sid]),
      clearImages: (sid) => calls.clearImages.push(sid),
      setOutput: (p) => calls.setOutput.push(p),
    },
    panels: { autoAdd: (id, sid) => calls.autoAdd.push([id, sid]) },
    ui: { css: { cmd: 'sh-cmd', empty: 'empty', glow: 'glow-text' } },
  };
  return {
    mu, calls, on,
    set(sid, patch) { media.set(sid, view({ ...(media.get(sid) ?? {}), ...patch })); for (const f of watchers.get(sid) ?? []) f(media.get(sid)); },
    open(sid) { sessions.push(sid); media.set(sid, view()); },
    close(sid) { sessions = sessions.filter((s) => s !== sid); },
    switch() { for (const f of [...on.switch]) f(null); },
    line(sid) { for (const f of [...on.line]) f({ text: '' }, { sid }); },
    live: (sid) => watchers.get(sid)?.size ?? 0,
  };
}

test('tracksOf: music first, then sounds; empty for null', () => {
  const m = view({ music: track('music', 'm', 'a/theme.ogg'), sounds: [track('sound', 's1', 'boom.wav'), track('sound', 's2', 'zap.mp3')] });
  assert.deepEqual(tracksOf(m).map((t) => t.key), ['m', 's1', 's2']);
  assert.deepEqual(tracksOf(view({ sounds: [track('sound', 's', 'x.wav')] })).map((t) => t.key), ['s']);
  assert.deepEqual(tracksOf(null), []);
});

test('titleOf: host title, else the file name without folder or extension', () => {
  assert.equal(titleOf({ title: 'Theme', name: 'a/b/theme.ogg' }), 'Theme');
  assert.equal(titleOf({ title: '', name: 'a/b/theme.ogg' }), 'theme');
  assert.equal(titleOf({ title: '', name: 'rain' }), 'rain');
  assert.equal(titleOf({ title: '', name: 'dir/' }), 'dir/');
});

test('pctOf rounds and clamps', () => {
  assert.equal(pctOf(0.5), 50);
  assert.equal(pctOf(0.333), 33);
  assert.equal(pctOf(1.7), 100);
  assert.equal(pctOf(-1), 0);
  assert.equal(pctOf(NaN), 0);
});

test('volumePatch: moving off 0 unmutes; 0 and unmuted leave muted alone', () => {
  assert.deepEqual(volumePatch(40, true), { volume: 0.4, muted: false });
  assert.deepEqual(volumePatch(40, false), { volume: 0.4 });
  assert.deepEqual(volumePatch(0, true), { volume: 0 });
  assert.deepEqual(volumePatch(250, false), { volume: 1 });
  assert.deepEqual(volumePatch(-5, false), { volume: 0 });
});

test('VOL is struck through when muted or at 0; the value reads — when muted', () => {
  assert.equal(isStruck(false, 50), false);
  assert.equal(isStruck(true, 50), true);
  assert.equal(isStruck(false, 0), true);
  assert.equal(volumeText(false, 42), '42%');
  assert.equal(volumeText(true, 42), '—');
  assert.equal(volumeValue(false, 42), '42', 'the panel shows the bare number, as Underspire');
  assert.equal(volumeValue(true, 42), '—');
  assert.equal(imageTitle({ url: 'u' }), 'u');
  assert.equal(imageTitle({ url: 'u', caption: 'c' }), 'c');
});

test('hasMedia: music, a sound or an image', () => {
  assert.equal(hasMedia(null), false);
  assert.equal(hasMedia(view()), false);
  assert.equal(hasMedia(view({ music: track('music', 'm', 'm.ogg') })), true);
  assert.equal(hasMedia(view({ sounds: [track('sound', 's', 's.wav')] })), true);
  assert.equal(hasMedia(view({ images: [{ url: 'u', ts: 1 }] })), true);
});

test('linkOf: http(s) only', () => {
  assert.equal(linkOf('https://x/a.ogg'), 'https://x/a.ogg');
  assert.equal(linkOf('HTTP://x/a.ogg'), 'HTTP://x/a.ogg');
  assert.equal(linkOf('javascript:alert(1)'), null);
  assert.equal(linkOf('a.ogg'), null);
  assert.equal(linkOf(undefined), null);
});

test('step: touches once on the first media; notes only music that starts after the first update', () => {
  const st = { touched: false, music: null, seeded: false };
  assert.deepEqual(step(st, view({ music: track('music', 'm', 'a.ogg') })), { touch: true, note: null }, 'already playing at start: no note');
  assert.deepEqual(step(st, view({ music: track('music', 'm', 'a.ogg'), volume: 0.2 })), { touch: false, note: null }, 'same piece');
  assert.deepEqual(step(st, view({ music: track('music', 'm', 'b.ogg') })), { touch: false, note: '♪ media: https://x/b.ogg' });
  assert.deepEqual(step(st, view()), { touch: false, note: null }, 'stopped');
  assert.deepEqual(step(st, view({ music: track('music', 'm', 'b.ogg') })), { touch: false, note: '♪ media: https://x/b.ogg' }, 'started again');
  const st2 = { touched: false, music: null, seeded: false };
  assert.deepEqual(step(st2, view()), { touch: false, note: null });
  assert.deepEqual(step(st2, view({ sounds: [track('sound', 's', 's.wav')] })), { touch: true, note: null }, 'a sound touches, never notes');
  assert.deepEqual(step(st2, view({ music: { ...track('music', 'm', 'x.ogg'), url: 'x.ogg' } })), { touch: false, note: null }, 'no note without an http(s) URL');
});

test('MEDIA_CSS: every rule under .ext-panel[data-ext="media"], no colour literals', () => {
  for (const line of MEDIA_CSS.trim().split('\n')) {
    for (const sel of line.slice(0, line.indexOf('{')).split(',')) assert.match(sel.trim(), /^\.ext-panel\[data-ext="media"\] \.mu-media(?=[\s.:]|$)/, line);
  }
  assert.doesNotMatch(MEDIA_CSS, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(MEDIA_CSS, /border-radius:\s*[1-9]/);
});

test('watchSessions: auto-adds once per session on the first track or image', () => {
  const f = fakeMu(['s1', 's2']);
  const off = watchSessions(f.mu);
  assert.deepEqual(f.calls.watch, ['s1', 's2']);
  assert.deepEqual(f.calls.autoAdd, []);
  f.set('s1', { volume: 0.2 });
  assert.deepEqual(f.calls.autoAdd, [], 'a volume change is not media');
  f.set('s1', { sounds: [track('sound', 'k', 'k.wav')] });
  f.set('s1', { images: [{ url: 'u', ts: 1 }] });
  f.set('s2', { images: [{ url: 'u', ts: 1 }] });
  assert.deepEqual(f.calls.autoAdd, [['media', 's1'], ['media', 's2']]);
  off();
});

test('watchSessions: a session already playing at activation is auto-added at once', () => {
  const f = fakeMu(['s1']);
  f.set('s1', { music: track('music', 'm', 'm.ogg') });
  const off = watchSessions(f.mu);
  assert.deepEqual(f.calls.autoAdd, [['media', 's1']]);
  off();
});

test('watchSessions: new sessions on switch or first line, gone sessions disposed, dispose ends all', () => {
  const f = fakeMu(['s1']);
  const off = watchSessions(f.mu);
  f.open('s2'); f.switch();
  assert.deepEqual(f.calls.watch, ['s1', 's2']);
  f.open('s3'); f.line('s3');
  assert.deepEqual(f.calls.watch, ['s1', 's2', 's3']);
  f.line('s3'); f.switch();
  assert.deepEqual(f.calls.watch, ['s1', 's2', 's3'], 'no second watch for a known session');
  f.close('s1'); f.switch();
  assert.deepEqual(f.calls.unwatch, ['s1']);
  assert.equal(f.live('s1'), 0);
  off();
  assert.deepEqual(f.calls.unwatch.sort(), ['s1', 's2', 's3']);
  assert.equal(f.on.switch.size, 0);
  assert.equal(f.on.line.size, 0);
  f.open('s4'); f.switch();
  assert.equal(f.calls.watch.includes('s4'), false, 'nothing after dispose');
});

const render = async (mu, sid) => {
  const Panel = createPanel(mu);
  return renderToString(createSSRApp({ render: () => h(Panel, { sid, worldId: null, params: {} }) }));
};

test('panel: empty states, the volume row and its testids', async () => {
  const f = fakeMu(['s1']);
  const html = await render(f.mu, 's1');
  for (const id of ['media', 'media-empty', 'media-vglyph', 'media-volume', 'media-noimages']) assert.match(html, new RegExp(`data-testid="${id}"`), id);
  assert.doesNotMatch(html, /media-tracks|media-gallery/);
  assert.match(html, new RegExp(COPY.nothing));
  assert.match(html, new RegExp(COPY.noImages));
  assert.match(html, /class="mu-media"/);
  assert.match(html, /--p:50%/);
  assert.match(html, /value="50"/);
  assert.match(html, /<span class="vval">50<\/span>/);
  assert.doesNotMatch(html, /data-testid="media-stop"/, 'no header Stop while nothing plays');
  assert.doesNotMatch(html, /data-testid="media-clear"/);
  assert.doesNotMatch(html, /vglyph muted/);
  assert.doesNotMatch(html, new RegExp(COPY.blocked));
  assert.deepEqual(f.calls.unwatch, [], 'SSR has no unmount; watch is real');
});

test('panel: tracks with Stop, images with Clear, muted and blocked', async () => {
  const f = fakeMu(['s1']);
  f.set('s1', {
    music: track('music', 'm', 'a/theme.ogg'), sounds: [track('sound', 's', 'boom.wav', 'Boom')],
    images: [{ url: 'https://x/a.png', caption: 'A map', ts: 1 }, { url: 'https://x/b.png', ts: 2 }],
    muted: true, blocked: true, volume: 0.8,
  });
  const html = await render(f.mu, 's1');
  assert.match(html, /data-testid="media-tracks"/);
  assert.match(html, /<button type="button" class="sh-cmd x" aria-label="stop" data-testid="media-stop">Stop<\/button>/, 'header Stop (everything)');
  assert.match(html, /<li class="music">.*?<a class="t" href="https:\/\/x\/a\/theme.ogg" target="_blank" rel="noopener" title="https:\/\/x\/a\/theme.ogg">theme<\/a>.*?music.*?aria-label="stop theme".*?Stop<\/button><\/li>/);
  assert.match(html, /<li class="sound">.*?Boom.*?aria-label="stop Boom"/);
  assert.match(html, /data-testid="media-gallery"/);
  assert.match(html, /<a class="thumb" href="https:\/\/x\/a.png" target="_blank" rel="noopener" title="A map"><img src="https:\/\/x\/a.png" alt="A map" loading="lazy"><\/a>/);
  assert.match(html, /title="https:\/\/x\/b.png"><img src="https:\/\/x\/b.png" alt loading/);
  assert.match(html, /aria-label="clear" data-testid="media-clear">Clear</);
  assert.match(html, /class="vglyph muted"/);
  assert.match(html, />—</);
  assert.match(html, /--p:80%/);
  assert.match(html, new RegExp(COPY.blocked));
});

test('panel: no session renders the empty states', async () => {
  const f = fakeMu([]);
  const html = await render(f.mu, null);
  assert.match(html, /data-testid="media-empty"/);
  assert.match(html, /data-testid="media-noimages"/);
  assert.deepEqual(f.calls.watch, []);
});

/** Run the component's setup outside an app and return its render function (to reach the event handlers). */
function setupOf(mu, sid) {
  const warn = console.warn; console.warn = () => {}; // onBeforeUnmount outside an instance
  try { return createPanel(mu).setup({ sid, worldId: null, params: {} }, { attrs: {}, slots: {}, emit() {}, expose() {} }); }
  finally { console.warn = warn; }
}
function find(vnode, pred, out = []) {
  if (!vnode || typeof vnode !== 'object') return out;
  if (Array.isArray(vnode)) { for (const v of vnode) find(v, pred, out); return out; }
  if (pred(vnode)) out.push(vnode);
  find(vnode.children, pred, out);
  return out;
}

test('panel handlers: Stop per track, Clear, the slider sets the output and unmutes off 0', () => {
  const f = fakeMu(['s1']);
  f.set('s1', { music: track('music', 'm', 'theme.ogg'), sounds: [track('sound', 's', 'boom.wav')], images: [{ url: 'u', ts: 1 }], muted: true });
  const tree = setupOf(f.mu, 's1')();
  const buttons = find(tree, (v) => v.type === 'button');
  const stops = buttons.filter((b) => b.children === COPY.stopLabel);
  assert.equal(stops.length, 3, 'the header Stop and one per track');
  stops.forEach((b) => b.props.onClick());
  assert.deepEqual(f.calls.stop, [[{}, 's1'], [{ key: 'm', type: 'music' }, 's1'], [{ key: 's', type: 'sound' }, 's1']]);
  buttons.find((b) => b.children === COPY.clear).props.onClick();
  assert.deepEqual(f.calls.clearImages, ['s1']);
  const slider = find(tree, (v) => v.type === 'input')[0];
  slider.props.onInput({ target: { value: '0' } });
  slider.props.onInput({ target: { value: '35' } });
  assert.deepEqual(f.calls.setOutput, [{ volume: 0 }, { volume: 0.35, muted: false }]);
  f.set('s1', { muted: false });
  slider.props.onInput({ target: { value: '60' } });
  assert.deepEqual(f.calls.setOutput.at(-1), { volume: 0.6 });
});

test('watchSessions: the per-session watch is disposed once autoAdd fired', () => {
  const f = fakeMu(['s1', 's2']);
  const off = watchSessions(f.mu);
  f.set('s1', { sounds: [track('sound', 'k', 'k.wav')] });
  assert.deepEqual(f.calls.autoAdd, [['media', 's1']]);
  assert.deepEqual(f.calls.unwatch, ['s1'], 'disposed right after it fired');
  assert.equal(f.live('s1'), 0);
  f.line('s1'); f.switch();
  assert.equal(f.calls.watch.filter((s) => s === 's1').length, 1, 'a session that fired is not watched again');
  assert.equal(f.live('s2'), 1);
  off();
  assert.deepEqual(f.calls.unwatch, ['s1', 's2']);
});

test('watchSessions: autoAdd during watch() itself (before it returns) still disposes that watch', () => {
  const f = fakeMu(['s1']);
  f.set('s1', { images: [{ url: 'u', ts: 1 }] });
  const off = watchSessions(f.mu);
  assert.deepEqual(f.calls.autoAdd, [['media', 's1']]);
  assert.deepEqual(f.calls.unwatch, ['s1']);
  assert.equal(f.live('s1'), 0);
  off();
  assert.deepEqual(f.calls.unwatch, ['s1'], 'nothing left to dispose');
});

test('watchSessions: a session gone before its first media stops in the callback without auto-adding', () => {
  const f = fakeMu(['s1']);
  const off = watchSessions(f.mu);
  f.close('s1'); // no switch yet
  f.set('s1', { music: track('music', 'm', 'm.ogg') });
  assert.deepEqual(f.calls.autoAdd, []);
  assert.deepEqual(f.calls.unwatch, ['s1']);
  assert.equal(f.live('s1'), 0);
  off();
});
