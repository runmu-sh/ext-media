/**
 * Media (@runmu.sh/ext-media): the Media panel (R-MEDIA), on the SDK. The host plays every cue (GMCP
 * Client.Media.*, MSP, `mu.media.play`), keeps each session's images (MXP <image>) and the master volume; this
 * extension draws them through `mu.media.watch` and drives them through `mu.media.stop`, `clearImages` and
 * `setOutput`.
 *
 * Per session (`mu.sessions.each`): the first track or image calls `mu.panels.touch`, which adds the panel once
 * per world on this device; new music can write a "♪ media: <url>" note to the log (the `noteMusic` setting).
 * The panel tab's menu and the palette have Stop all and Clear images while the panel is open.
 */
import { defineExtension, type Mu } from '@muclient/sdk';
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
    mu.settings.define({
      title: COPY.title,
      items: [{ key: 'noteMusic', label: COPY.noteSetting, hint: COPY.noteHint, kind: 'toggle', default: false, scope: 'both' }],
    });
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
