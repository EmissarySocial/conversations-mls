import m from "mithril"

import { ViewController } from "./controller"
import { App } from "./app"

// buildRoutes returns the Mithril route table for the application.
//
// STRATEGY (facade-preserving, gates-as-wrapper): every route renders the same
// <App> shell. <App> first applies the app-level "gates" (stopped / blurred /
// loading / welcome / sign-in, driven by controller state, NOT the URL); only when
// the app is "ready" does it render the route-matched content. So the URL is the
// source of truth for which ready-page shows (groups vs. settings, which group,
// which sub-tab), while non-page gates stay as controller state.
//
// Group selection is driven by the `:groupId` route param via onmatch: navigating
// to /groups/:groupId selects that group before the view renders.
export function buildRoutes(controller: ViewController): m.RouteDefs {

	// shell renders the App for a route, syncing the selected group from the `id`
	// query param into controller state on every render.
	//
	// The group id is carried as a QUERY PARAM (?id=...), not a path segment, because
	// plaintext group ids are full URLs containing "/" — Mithril decodes path params
	// before matching, so a slash-bearing value silently breaks a `:groupId` segment
	// and drops it. Query params round-trip any string safely, and unify what were
	// three near-identical group routes into one id-handling site.
	//
	// The sync runs in RENDER, not onmatch: Mithril only re-runs onmatch when the
	// matched route KEY changes, and a query-only change (/groups → /groups?id=X)
	// keeps the same key, so onmatch would not fire. render runs on every route and
	// query change. routeSelectGroup is a no-op when the id is unchanged, so this is
	// safe to call each render (no reload loop).
	const shell = (): m.RouteResolver => ({
		render: () => {
			controller.routeSelectGroup(m.route.param("id") ?? "")
			return <App controller={controller} />
		},
	})

	return {
		// /groups (no ?id) is the list; /groups?id=<gid> opens that conversation.
		// The slash-free sub-pages stay as path segments; the group id rides along in
		// ?id= for each.
		"/groups": shell(),
		"/groups/notes": shell(),
		"/groups/people": shell(),
		// /settings is the "list" (tab list, mobile list screen); /settings/:tab is a
		// specific tab (the detail). Settings tab ids are slash-free, so a path param
		// is fine here.
		"/settings": shell(),
		"/settings/:tab": shell(),
	}
}
