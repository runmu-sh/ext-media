/**
 * Media (@runmu.sh/ext-media): the Media panel (R-MEDIA), moved out of the μClient world-panels core onto the
 * SDK. The host still plays every cue (GMCP Client.Media.*, MSP, `mu.media.play`), keeps each session's images
 * (MXP <image>) and the master volume; this extension only draws them, through `mu.media.watch`, and drives
 * them through `mu.media.stop`, `clearImages` and `setOutput`.
 *
 * The first time a session plays something or shows an image the panel is auto-added (R-AUTO-PANELS),
 * once per world on this device.
 */
import { defineExtension, type Mu } from '@muclient/sdk';
import { createPanel } from './panel.ts';
import { COPY, MEDIA_CSS, watchSessions } from './model.ts';

export { COPY, MEDIA_CSS, hasMedia, imageTitle, isStruck, pctOf, titleOf, tracksOf, volumePatch, volumeText, watchSessions } from './model.ts';

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    // The style and the panel are tracked by the host and disposed with the extension.
    mu.ui.style(MEDIA_CSS);
    mu.panels.register({
      id: 'media', title: COPY.title, singleton: true, perSession: true, defaultPosition: 'right-top', order: 30,
      mount: mu.panels.vue(createPanel(mu)),
    });
    // The per-session watches end on deactivate (and each one once it fired or when its session goes away).
    ctx.subscriptions.push(watchSessions(mu, 'media'));
  },
});
