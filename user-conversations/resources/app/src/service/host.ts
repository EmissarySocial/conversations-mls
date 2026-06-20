// Quick and dirty wrapper for htmx, which the host app is guaranteed to have running.

import type { IHost } from "./interfaces"

// If you're using a non-Emissary host app, then you'll need to redefine these host bindings.
declare const htmx: {
	ajax(method: string, url: string): void
}

// Host defines all of the bindings between this Conversations app and the host web page.
// This component is built to work with default Emissary routes.
export class Host implements IHost {

	reload() {
		globalThis.location.reload()
	}

	viewActor(actorId: string) {
		htmx.ajax("GET", "/@me/newsfeed/browse-actor?url=" + encodeURIComponent(actorId))
	}

	viewKeyPackages() {
		globalThis.location.assign("/@me/settings/keyPackages")
	}

	viewBlockActor(actorId: string) {
		htmx.ajax("GET", "/@me/settings/actor-rule?actor=" + encodeURIComponent(actorId))
	}

	notify(title: string, message: string) {
		if (Notification.permission === "granted") {
			new Notification(title, {
				body: message,
			})
		}
	}
}