# `/view` — Mithril UI

The presentation layer: [Mithril](https://mithril.js.org/) components (JSX via esbuild's
`--jsx-factory=m`). Components receive a controller and call its methods; they hold minimal
local state. See the [app README](../../README.md) §3.

## File naming

- `app-*.tsx` — top-level screens chosen by `app.tsx`'s page-view switch (loading, sign-in,
  settings, blurred, stopped).
- `index.tsx` — the live app shell (sidebar + detail + modals); `groups.tsx` is the sidebar.
- `group-*.tsx` — the detail panes (messages, members, notes, leave, welcome).
- `modal-*.tsx` — dialogs, gated by the controller's `modalView` state.
- `widget-*.tsx` — reusable pieces (filter menu, emoji picker, actor search, mention popup).

## What matters here

- **Components talk to `ViewController`, not the service `Controller`.** All views import
  `{ ViewController }` from `./controller`. That file is currently a thin façade over
  `service/controller.ts`; UI-only concerns are migrating into it. Don't import
  `../service/controller` from a component — go through the façade.
- **CSS lives in a GLOBAL namespace — this is the #1 footgun.** The app renders inside
  Emissary's theme, so `user-conversations/stylesheet/stylesheet.css` shares a namespace with
  `theme-global/stylesheet/*.css`. Never redefine a global/Mastodon utility class with a bare
  selector — `.ellipsis`, `.invisible`, `.mention`, `.hashtag`, `.popup` are all global. A bare
  local rule silently collides on every element using that class (a real bug appended a stray
  "…" to every group label). **Scope to a container** (`.message-content .invisible`) or use an
  app-specific name; grep `theme-global/stylesheet/*.css` first. See [app README](../../README.md) §7.
- **Static skeletons must track their live counterparts.** `app-loading.tsx` hand-renders a
  copy of the `index.tsx` / `groups.tsx` sidebar chrome (it runs *before* the controller
  exists, so it can't call into it). When the real sidebar changes, update the loading skeleton
  to match — they drift silently otherwise.
- **Keep view state thin and let the controller redraw.** Components read controller state and
  fire controller methods; the controller owns `m.redraw()`. Avoid duplicating app state in
  component-local fields.
- **Inbound remote HTML is sanitized, not trusted.** Message content passes through DOMPurify
  (`service/utils.ts` allow-list) before rendering; don't bypass it with raw `m.trust()` on
  untrusted strings.
