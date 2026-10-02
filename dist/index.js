// src/index.ts
import { defineExtension } from "@muclient/sdk";

// src/panel.ts
import { defineComponent, h, onBeforeUnmount, shallowRef, watch } from "vue";

// src/model.ts
var COPY = {
  title: "Media",
  nowPlaying: "Now playing",
  nothing: "Nothing playing",
  images: "Images",
  noImages: "No images",
  clear: "Clear",
  stopLabel: "Stop",
  stop: (name) => `stop ${name}`,
  volume: "volume",
  vol: "Vol",
  blocked: "click anywhere to allow audio",
  open: "open media",
  /** The header [ STOP ] (Underspire's): stops everything the session plays. @since 1.1.0 */
  stopAll: "stop",
  /** The gallery's [ CLEAR ] aria-label (Underspire's). @since 1.1.0 */
  clearLabel: "clear",
  /** The log note when new music starts (Underspire's media note). @since 1.1.0 */
  note: (url) => `\u266A media: ${url}`,
  /** The setting that turns the note on. @since 1.1.0 */
  noteSetting: "Note new music in the log",
  noteHint: "A \u266A media line with the link, each time the game starts a new piece of music"
};
var MEDIA_CSS = `
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
function tracksOf(m) {
  return m ? [...m.music ? [m.music] : [], ...m.sounds] : [];
}
function titleOf(t) {
  if (t.title) return t.title;
  return (t.name.split("/").pop() || t.name).replace(/\.[a-z0-9]{2,4}$/i, "");
}
function pctOf(volume) {
  const v = Math.round(Number(volume) * 100);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0;
}
function volumePatch(pct, muted) {
  const p = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
  return p > 0 && muted ? { volume: p / 100, muted: false } : { volume: p / 100 };
}
var isStruck = (muted, pct) => muted || pct === 0;
var volumeText = (muted, pct) => muted ? "\u2014" : `${pct}%`;
var volumeValue = (muted, pct) => muted ? "\u2014" : String(pct);
var linkOf = (url) => typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
var imageTitle = (i) => i.caption || i.url;
function hasMedia(m) {
  return !!m && (!!m.music || m.sounds.length > 0 || m.images.length > 0);
}
function step(st, m) {
  const touch = !st.touched && hasMedia(m);
  if (touch) st.touched = true;
  const music = m?.music ? `${m.music.key}\0${m.music.url}` : null;
  let note = null;
  if (st.seeded && music && music !== st.music) {
    const url = linkOf(m.music.url);
    if (url) note = COPY.note(url);
  }
  st.music = music;
  st.seeded = true;
  return { touch, note };
}
function watchSessions(mu, panel = "media") {
  const watches = /* @__PURE__ */ new Map();
  const added = /* @__PURE__ */ new Set();
  let live = true;
  const isLive = (sid) => mu.sessions.list().some((s) => s.id === sid);
  const stop = (sid) => {
    const off = watches.get(sid);
    watches.delete(sid);
    off?.();
  };
  const ensure = (sid) => {
    if (!live || !sid || added.has(sid) || watches.has(sid)) return;
    let ended = false;
    const end = () => {
      ended = true;
      stop(sid);
    };
    const off = mu.media.watch((m) => {
      if (ended) return;
      if (!isLive(sid)) {
        end();
        return;
      }
      if (!hasMedia(m)) return;
      added.add(sid);
      mu.panels.autoAdd(panel, sid);
      end();
    }, sid);
    if (ended) off();
    else watches.set(sid, off);
  };
  const sync = () => {
    if (!live) return;
    const ids = new Set(mu.sessions.list().map((s) => s.id));
    for (const sid of [...watches.keys()]) if (!ids.has(sid)) stop(sid);
    for (const sid of [...added]) if (!ids.has(sid)) added.delete(sid);
    for (const sid of ids) ensure(sid);
  };
  const offSwitch = mu.sessions.on("switch", sync);
  const offLine = mu.sessions.on("line", (_l, { sid }) => {
    if (!watches.has(sid) && !added.has(sid)) sync();
  });
  sync();
  return () => {
    live = false;
    offSwitch();
    offLine();
    for (const sid of [...watches.keys()]) stop(sid);
    added.clear();
  };
}

// src/panel.ts
function createPanel(mu) {
  const c = mu.ui.css;
  const empty = (...more) => [.../* @__PURE__ */ new Set([c.empty, "empty", ...more])].join(" ");
  return defineComponent({
    name: "MediaPanel",
    props: { sid: { type: String, default: null }, worldId: { type: String, default: null }, params: { type: Object, default: () => ({}) } },
    setup(props) {
      const m = shallowRef(null);
      let off = null;
      const attach = (sid) => {
        off?.();
        off = null;
        m.value = null;
        if (sid) off = mu.media.watch((v) => {
          m.value = v;
        }, sid);
      };
      watch(() => props.sid, attach, { immediate: true });
      onBeforeUnmount(() => {
        off?.();
        off = null;
      });
      const onVolume = (e) => {
        const v = Number(e.target.value);
        mu.media.setOutput(volumePatch(v, !!m.value?.muted));
      };
      return () => {
        const sid = props.sid;
        const v = m.value;
        const tracks = tracksOf(v);
        const muted = !!v?.muted;
        const pct = pctOf(v?.volume ?? 0);
        const images = v?.images ?? [];
        const head = (label, tool) => h("div", { class: "hd" }, [h("span", { class: `tag ${c.glow}` }, label), tool ?? null]);
        return h("section", { class: "mu-media", "aria-label": COPY.title, "data-testid": "media" }, [
          h("div", { class: "np" }, [
            head(COPY.nowPlaying, tracks.length ? h("button", {
              type: "button",
              class: `${c.cmd} x`,
              "aria-label": COPY.stopAll,
              "data-testid": "media-stop",
              onClick: () => {
                if (sid) mu.media.stop({}, sid);
              }
            }, COPY.stopLabel) : null),
            tracks.length ? h("ul", { class: "tracks", "data-testid": "media-tracks" }, tracks.map((t) => h("li", { key: t.kind + t.key, class: t.kind }, [
              h("span", { class: "g", "aria-hidden": "true" }, "\u266A"),
              linkOf(t.url) ? h("a", { class: "t", href: t.url, target: "_blank", rel: "noopener", title: t.url }, titleOf(t)) : h("span", { class: "t" }, titleOf(t)),
              h("span", { class: "k" }, t.kind),
              h("button", {
                type: "button",
                class: `${c.cmd} x`,
                "aria-label": COPY.stop(titleOf(t)),
                onClick: () => {
                  if (sid) mu.media.stop({ key: t.key, type: t.kind }, sid);
                }
              }, COPY.stopLabel)
            ]))) : h("p", { class: empty(), "data-testid": "media-empty" }, COPY.nothing),
            v?.blocked ? h("p", { class: empty("blocked") }, COPY.blocked) : null,
            h("label", { class: "vol" }, [
              h("span", { class: ["vglyph", { muted: isStruck(muted, pct) }], "aria-hidden": "true", "data-testid": "media-vglyph" }, COPY.vol),
              h("input", {
                type: "range",
                min: 0,
                max: 100,
                step: 1,
                class: "rng",
                value: pct,
                style: { "--p": `${pct}%` },
                "aria-label": COPY.volume,
                "data-testid": "media-volume",
                onInput: onVolume
              }),
              h("span", { class: "vval" }, volumeValue(muted, pct))
            ])
          ]),
          h("div", { class: "gallery" }, [
            head(COPY.images, images.length ? h("button", { type: "button", class: `${c.cmd} x`, "aria-label": COPY.clearLabel, "data-testid": "media-clear", onClick: () => {
              if (sid) mu.media.clearImages(sid);
            } }, COPY.clear) : null),
            images.length ? h("div", { class: "grid", "data-testid": "media-gallery" }, images.map((i) => h("a", { key: i.url, class: "thumb", href: i.url, target: "_blank", rel: "noopener", title: imageTitle(i) }, [
              h("img", { src: i.url, alt: i.caption || "", loading: "lazy" })
            ]))) : h("p", { class: empty(), "data-testid": "media-noimages" }, COPY.noImages)
          ])
        ]);
      };
    }
  });
}

// src/index.ts
var index_default = defineExtension({
  activate(ctx) {
    const mu = ctx.mu;
    mu.ui.style(MEDIA_CSS);
    mu.settings.define({
      title: COPY.title,
      items: [{ key: "noteMusic", label: COPY.noteSetting, hint: COPY.noteHint, kind: "toggle", default: false, scope: "both" }]
    });
    mu.panels.register({
      id: "media",
      title: COPY.title,
      singleton: true,
      perSession: true,
      defaultPosition: "right-top",
      order: 30,
      mount: mu.panels.vue(createPanel(mu))
    });
    const sidNow = () => mu.sessions.active()?.id ?? null;
    const stopAll = () => {
      const s = sidNow();
      if (s) mu.media.stop({}, s);
    };
    const clear = () => {
      const s = sidNow();
      if (s) mu.media.clearImages(s);
    };
    mu.commands.register({ id: "media.stop", title: "Stop all media", group: COPY.title, when: "panel:media", run: stopAll });
    mu.commands.register({ id: "media.clear", title: "Clear images", group: COPY.title, when: "panel:media", run: clear });
    mu.menus.add({ id: "media.stop", slot: "panel:media", title: "Stop all", order: 10, command: "media.stop" });
    mu.menus.add({ id: "media.clear", slot: "panel:media", title: "Clear images", order: 20, command: "media.clear" });
    mu.sessions.each((s) => {
      const st = { touched: false, music: null, seeded: false };
      return mu.media.watch((m) => {
        const r = step(st, m);
        if (r.touch) mu.panels.touch("media", s.id);
        if (r.note && mu.settings.get("noteMusic", { sid: s.id })) mu.sessions.echo(r.note, s.id);
      }, s.id);
    });
  }
});
export {
  COPY,
  MEDIA_CSS,
  index_default as default,
  hasMedia,
  imageTitle,
  isStruck,
  linkOf,
  pctOf,
  step,
  titleOf,
  tracksOf,
  volumePatch,
  volumeText,
  volumeValue,
  watchSessions
};
