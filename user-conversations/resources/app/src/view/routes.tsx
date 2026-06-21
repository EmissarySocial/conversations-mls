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

	// shell renders the App for a given route. onmatch syncs route params into
	// controller state (group selection / settings tab) before rendering.
	const shell = (onmatch?: (params: m.Params) => void): m.RouteResolver => ({
		onmatch: (params: m.Params) => {
			onmatch?.(params)
			// Returning undefined keeps the same component mounted across routes,
			// so the app shell is not torn down and rebuilt on every navigation.
			return undefined
		},
		render: () => <App controller={controller} />,
	})

	// groupId reads the (always-string) :groupId route param.
	const groupId = (p: m.Params): string => (p["groupId"] as string | undefined) ?? ""

	return {
		"/groups": shell(() => controller.routeSelectGroup("")),
		"/groups/:groupId": shell((p) => controller.routeSelectGroup(groupId(p))),
		"/groups/:groupId/notes": shell((p) => controller.routeSelectGroup(groupId(p))),
		"/groups/:groupId/people": shell((p) => controller.routeSelectGroup(groupId(p))),
		"/settings": { onmatch: () => { m.route.set("/settings/:tab", { tab: "general" }) } },
		"/settings/:tab": shell(),
	}
}
