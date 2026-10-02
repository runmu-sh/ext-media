// The extension in the headless μClient host (@runmu.sh/dev/test): registration, per-session touch and note,
// the panel menu and commands, and clean disposal. `mu.media` is modelled here (the stub records calls only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { createHost } = await import(pathToFileURL(createRequire(join(ROOT, 'package.json')).resolve('@runmu.sh/dev/test')).href);

const track = (kind, key, name) => ({ key, name, title: '', url: `https://x/${name}`, kind, volume: 50, loops: 1 });
const view = (over = {}) => ({ music: null, sounds: [], images: [], blocked: false, volume: 0.5, muted: false, ...over });

/** A host whose `mu.media` keeps a view per session and calls its watchers, as μClient's does. */
function mediaHost(opts) {
  const host = createHost({ root: ROOT, ...opts });
  const state = new Map(), watchers = new Map();
  const media = host.mu.media;
  media.get = (sid) => state.get(sid) ?? view();
  media.watch = (fn, sid) => {
    const set = watchers.get(sid) ?? watchers.set(sid, new Set()).get(sid);
    set.add(fn); fn(media.get(sid));
    return () => set.delete(fn);
  };
  media.stop = (f, sid) => host.calls.push({ path: 'media.stop', args: [f, sid] });
  media.clearImages = (sid) => host.calls.push({ path: 'media.clearImages', args: [sid] });
  const set = (sid, patch) => { state.set(sid, view({ ...(state.get(sid) ?? {}), ...patch })); for (const f of [...(watchers.get(sid) ?? [])]) f(state.get(sid)); };
  return { host, set, watching: (sid) => watchers.get(sid)?.size ?? 0 };
}
const calls = (host, path) => host.calls.filter((c) => c.path === path).map((c) => c.args);

test('registers the panel, its commands, menu rows and the note setting; asks for no capability', async () => {
  const { host } = mediaHost();
  await host.load('src/index.ts');
  const p = host.panels.get('media');
  assert.deepEqual({ id: p.id, title: p.title, singleton: p.singleton, perSession: p.perSession, defaultPosition: p.defaultPosition, order: p.order },
    { id: 'media', title: 'Media', singleton: true, perSession: true, defaultPosition: 'right-top', order: 30 });
  assert.equal(p.show, undefined, 'listed in Views from the start, as before');
  assert.equal(host.commands.get('media.stop').when, 'panel:media');
  assert.equal(host.commands.get('media.clear').when, 'panel:media');
  assert.deepEqual(calls(host, 'menus.add').map(([m]) => [m.id, m.slot, m.command]), [['media.stop', 'panel:media', 'media.stop'], ['media.clear', 'panel:media', 'media.clear']]);
  assert.equal(host.setting('noteMusic'), false);
  assert.ok(host.live().includes('ui.style'));
  assert.ok(!host.live().includes('sessions.on:line'), 'no line listener (no read-output)');
  assert.deepEqual(host.errors, []);
});

test('touches the panel once per session on its first track or image, including sessions opened later', async () => {
  const { host, set } = mediaHost({ sessions: [{ id: 's1', worldId: 'w1' }, { id: 's2', worldId: 'w2' }] });
  set('s2', { images: [{ url: 'https://x/a.png', ts: 1 }] });
  await host.load('src/index.ts');
  assert.deepEqual(calls(host, 'panels.touch'), [['media', 's2']], 'a session already showing an image');
  set('s1', { volume: 0.2 });
  assert.equal(calls(host, 'panels.touch').length, 1, 'a volume change is not media');
  set('s1', { sounds: [track('sound', 'k', 'k.wav')] });
  set('s1', { music: track('music', 'm', 'm.ogg') });
  host.open({ id: 's3', worldId: 'w3' });
  set('s3', { music: track('music', 'm', 'm.ogg') });
  assert.deepEqual(calls(host, 'panels.touch'), [['media', 's2'], ['media', 's1'], ['media', 's3']]);
});

test('closing a session or unloading ends its watch', async () => {
  const { host, watching } = mediaHost({ sessions: [{ id: 's1', worldId: 'w1' }, { id: 's2', worldId: 'w2' }] });
  await host.load('src/index.ts');
  assert.equal(watching('s1'), 1);
  host.close('s1');
  assert.equal(watching('s1'), 0);
  assert.equal(watching('s2'), 1);
  await host.unload();
  assert.equal(watching('s2'), 0);
  assert.deepEqual(host.live(), []);
  assert.deepEqual(host.errors, []);
});

test('the media note: off by default; on, one ♪ media line per new piece of music in that session', async () => {
  const { host, set } = mediaHost({ sessions: [{ id: 's1', worldId: 'w1' }, { id: 's2', worldId: 'w2' }] });
  await host.load('src/index.ts');
  set('s1', { music: track('music', 'm', 'a.ogg') });
  assert.deepEqual(calls(host, 'sessions.echo'), [], 'off by default');
  host.mu.settings.set('noteMusic', true);
  set('s1', { music: track('music', 'm', 'b.ogg') });
  set('s1', { music: track('music', 'm', 'b.ogg'), volume: 0.3 });
  set('s1', { sounds: [track('sound', 's', 'boom.wav')] });
  set('s2', { music: track('music', 'm', 'c.ogg') });
  assert.deepEqual(calls(host, 'sessions.echo'), [['♪ media: https://x/b.ogg', 's1'], ['♪ media: https://x/c.ogg', 's2']]);
});

test('Stop all and Clear images act on the active session', async () => {
  const { host } = mediaHost({ sessions: [{ id: 's1', worldId: 'w1' }, { id: 's2', worldId: 'w2' }] });
  await host.load('src/index.ts');
  host.switchTo('s2');
  host.mu.commands.run('media.stop');
  host.mu.commands.run('media.clear');
  assert.deepEqual(calls(host, 'media.stop'), [[{}, 's2']]);
  assert.deepEqual(calls(host, 'media.clearImages'), [['s2']]);
});
