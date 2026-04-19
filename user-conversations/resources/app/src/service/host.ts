// Quick and dirty wrapper for htmx, which the host app is guaranteed to have running.

import type { Actor } from "../as/actor"

// If you're using a non-Emissary host app, then you'll need to redefine these host bindings.
declare const htmx: {
	ajax(method: string, url: string): void
}

// Host defines all of the bindings between this Conversations app and the host web page.
// This component is built to work with default Emissary routes.
export class Host {

	viewActor(actorId: string) {
		htmx.ajax("GET", "/@me/newsfeed/browse-actor?url=" + encodeURIComponent(actorId))
	}

	viewKeyPackages() {
		window.location.assign("/@me/settings/keyPackages")
	}
}