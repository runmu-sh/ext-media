/**
 * The public types of @runmu.sh/ext-media. The extension exports no runtime API to other extensions (activate
 * returns nothing); the module's named exports (helpers in model.ts) are for tests and reuse.
 */
/** What a session's watcher remembers between media updates (see `step`). @since 1.1.0 */
export interface SessionState { touched: boolean; music: string | null; seeded: boolean }
/** The extension's one setting. @since 1.1.0 */
export interface MediaSettings { noteMusic: boolean }
