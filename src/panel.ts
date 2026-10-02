/**
 * The Media panel as a Vue component (render functions; `vue` is the host's own instance through the import
 * map). Composed as Underspire's: a NOW PLAYING block (accent bottom rule) whose head has [ STOP ] (everything)
 * while something plays, the tracks (title linking to the file, [ STOP ] each), the volume row (VOL label,
 * struck through when muted or at 0; slider; the bare value), then the IMAGES block with [ CLEAR ] and a 72px
 * thumbnail grid.
 */
import { defineComponent, h, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { Dispose, MediaView, Mu } from '@muclient/sdk';
import { COPY, imageTitle, isStruck, linkOf, pctOf, titleOf, tracksOf, volumePatch, volumeValue } from './model.ts';

export function createPanel(mu: Mu) {
  const c = mu.ui.css;
  // The host's empty label class, plus the panel's own `.empty` rule (deduplicated when they are the same).
  const empty = (...more: string[]) => [...new Set([c.empty, 'empty', ...more])].join(' ');
  return defineComponent({
    name: 'MediaPanel',
    props: { sid: { type: String, default: null }, worldId: { type: String, default: null }, params: { type: Object, default: () => ({}) } },
    setup(props) {
      const m = shallowRef<MediaView | null>(null);
      let off: Dispose | null = null;
      const attach = (sid: string | null) => {
        off?.(); off = null; m.value = null;
        if (sid) off = mu.media.watch((v) => { m.value = v; }, sid);
      };
      watch(() => props.sid as string | null, attach, { immediate: true });
      onBeforeUnmount(() => { off?.(); off = null; });

      const onVolume = (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        mu.media.setOutput(volumePatch(v, !!m.value?.muted));
      };

      return () => {
        const sid = props.sid as string | null;
        const v = m.value;
        const tracks = tracksOf(v);
        const muted = !!v?.muted;
        const pct = pctOf(v?.volume ?? 0);
        const images = v?.images ?? [];
        const head = (label: string, tool?: ReturnType<typeof h> | null) =>
          h('div', { class: 'hd' }, [h('span', { class: `tag ${c.glow}` }, label), tool ?? null]);

        return h('section', { class: 'mu-media', 'aria-label': COPY.title, 'data-testid': 'media' }, [
          h('div', { class: 'np' }, [
            head(COPY.nowPlaying, tracks.length
              ? h('button', {
                type: 'button', class: `${c.cmd} x`, 'aria-label': COPY.stopAll, 'data-testid': 'media-stop',
                onClick: () => { if (sid) mu.media.stop({}, sid); },
              }, COPY.stopLabel)
              : null),
            tracks.length
              ? h('ul', { class: 'tracks', 'data-testid': 'media-tracks' }, tracks.map((t) =>
                h('li', { key: t.kind + t.key, class: t.kind }, [
                  h('span', { class: 'g', 'aria-hidden': 'true' }, '♪'),
                  linkOf(t.url)
                    ? h('a', { class: 't', href: t.url, target: '_blank', rel: 'noopener', title: t.url }, titleOf(t))
                    : h('span', { class: 't' }, titleOf(t)),
                  h('span', { class: 'k' }, t.kind),
                  h('button', {
                    type: 'button', class: `${c.cmd} x`, 'aria-label': COPY.stop(titleOf(t)),
                    onClick: () => { if (sid) mu.media.stop({ key: t.key, type: t.kind }, sid); },
                  }, COPY.stopLabel),
                ])))
              : h('p', { class: empty(), 'data-testid': 'media-empty' }, COPY.nothing),
            v?.blocked ? h('p', { class: empty('blocked') }, COPY.blocked) : null,
            h('label', { class: 'vol' }, [
              h('span', { class: ['vglyph', { muted: isStruck(muted, pct) }], 'aria-hidden': 'true', 'data-testid': 'media-vglyph' }, COPY.vol),
              h('input', {
                type: 'range', min: 0, max: 100, step: 1, class: 'rng', value: pct, style: { '--p': `${pct}%` },
                'aria-label': COPY.volume, 'data-testid': 'media-volume', onInput: onVolume,
              }),
              h('span', { class: 'vval' }, volumeValue(muted, pct)),
            ]),
          ]),
          h('div', { class: 'gallery' }, [
            head(COPY.images, images.length
              ? h('button', { type: 'button', class: `${c.cmd} x`, 'aria-label': COPY.clearLabel, 'data-testid': 'media-clear', onClick: () => { if (sid) mu.media.clearImages(sid); } }, COPY.clear)
              : null),
            images.length
              ? h('div', { class: 'grid', 'data-testid': 'media-gallery' }, images.map((i) =>
                h('a', { key: i.url, class: 'thumb', href: i.url, target: '_blank', rel: 'noopener', title: imageTitle(i) }, [
                  h('img', { src: i.url, alt: i.caption || '', loading: 'lazy' }),
                ])))
              : h('p', { class: empty(), 'data-testid': 'media-noimages' }, COPY.noImages),
          ]),
        ]);
      };
    },
  });
}
