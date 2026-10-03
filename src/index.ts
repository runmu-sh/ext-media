/**
 * Media (@runmu.sh/ext-media): the Media panel (R-MEDIA), on the SDK. The host plays every cue (GMCP
 * Client.Media.*, MSP, `mu.media.play`), keeps each session's images (MXP <image>) and the master volume; this
 * extension draws them through `mu.media.watch` and drives them through `mu.media.stop`, `clearImages` and
 * `setOutput`.
 *
 * Per session (`mu.sessions.each`): the first track or image calls `mu.panels.touch`, which adds the panel once
 * per world on this device; new music can write a "♪ media: <url>" note to the log (the `noteMusic` setting).
 * The panel tab's menu and the palette have Stop all and Clear images while the panel is open. On a 1.14 host the
 * ☰ Sound row's now-playing line opens the panel, and the settings page has shortcut rows for both commands.
 */
import { defineExtension, type Mu, type SettingsSchema } from '@muclient/sdk';
import { createPanel } from './panel.ts';
import { COPY, MEDIA_CSS, step, type SessionState } from './model.ts';

export {
  COPY, MEDIA_CSS, hasMedia, imageTitle, isStruck, linkOf, pctOf, step, titleOf, tracksOf, volumePatch, volumeText, volumeValue, watchSessions,
} from './model.ts';
export type { MediaSettings, SessionState } from './types.ts';

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    // Everything below is tracked by the host and disposed with the extension.
    mu.ui.style(MEDIA_CSS);
    mu.panels.register({
      id: 'media', title: COPY.title, singleton: true, perSession: true, defaultPosition: 'right-top', order: 30,
      mount: mu.panels.vue(createPanel(mu)),
    });

    const sidNow = () => mu.sessions.active()?.id ?? null;
    const stopAll = () => { const s = sidNow(); if (s) mu.media.stop({}, s); };
    const clear = () => { const s = sidNow(); if (s) mu.media.clearImages(s); };
    mu.commands.register({ id: 'media.stop', title: 'Stop all media', group: COPY.title, when: 'panel:media', run: stopAll });
    mu.commands.register({ id: 'media.clear', title: 'Clear images', group: COPY.title, when: 'panel:media', run: clear });
    mu.menus.add({ id: 'media.stop', slot: 'panel:media', title: 'Stop all', order: 10, command: 'media.stop' });
    mu.menus.add({ id: 'media.clear', slot: 'panel:media', title: 'Clear images', order: 20, command: 'media.clear' });

    // SDK 1.14: the ☰ Sound row's now-playing line opens the panel. A host before 1.14 throws `unknown slot` here;
    // the extension then runs as on 1.12 (the old host opens the panel from that line itself).
    let host114 = true;
    try {
      mu.menus.add({ id: 'media.open', slot: 'now-playing', title: COPY.open, run: () => mu.panels.open('media', undefined, { focus: true }) });
    } catch {
      host114 = false;
    }
    // Shortcut rows (SDK 1.14) bind Stop all and Clear images in the player's key bindings. An older host would draw
    // an unknown item kind as a text field, so they are defined only on a host that accepted the now-playing slot.
    const items: SettingsSchema['items'] = [{ key: 'noteMusic', label: COPY.noteSetting, hint: COPY.noteHint, kind: 'toggle', default: false, scope: 'both' }];
    if (host114) {
      items.push(
        { key: 'keys.stop', kind: 'shortcut', command: 'media.stop', group: COPY.keysGroup },
        { key: 'keys.clear', kind: 'shortcut', command: 'media.clear', group: COPY.keysGroup },
      );
    }
    mu.settings.define({ title: COPY.title, items });

    mu.sessions.each((s) => {
      const st: SessionState = { touched: false, music: null, seeded: false };
      return mu.media.watch((m) => {
        const r = step(st, m);
        if (r.touch) mu.panels.touch('media', s.id);
        if (r.note && mu.settings.get<boolean>('noteMusic', { sid: s.id })) mu.sessions.echo(r.note, s.id);
      }, s.id);
    });
  },
});
