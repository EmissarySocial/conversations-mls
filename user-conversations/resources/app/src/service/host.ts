// Quick and dirty wrapper for htmx, which the host app is guaranteed to have running.

import type { Actor } from "../as/actor"

// If you're using a non-Emissary host app, then you'll need to redefine these host bindings.
declare const htmx: {
	ajax(method: string, url: string): void
}

// Host defines all of the bindings between this Conversations app and the host web page.
// This component is built to work with default Emissary routes.
export class Host {

	reload() {
		window.location.reload()
	}

	viewActor(actorId: string) {
		htmx.ajax("GET", "/@me/newsfeed/browse-actor?url=" + encodeURIComponent(actorId))
	}

	viewKeyPackages() {
		window.location.assign("/@me/settings/keyPackages")
	}

	//////////////////////////////////////////
	// State Watcher
	//////////////////////////////////////////

	watchSignin = (stop: (message: string) => void) => {

		// If the cookieStore API is available, use it
		// to listen for Application state changes
		if (typeof cookieStore !== "undefined") {
			cookieStore.addEventListener("change", async () => {
				console.log("cookies changed (via CookieStore API)")
				stop("COOKIES-CHANGED")
			})

			// Since we're using the cookieStore API, we're done here.
			return
		}

		// Fall through means that we need to poll this on our own
		const originalCookie = document.cookie;

		const intervalId = setInterval(() => {
			if (document.cookie !== originalCookie) {
				console.log("cookies changed (via polling)")
				stop("COOKIES-CHANGED")
			}
		}, 1000);

		// Return a cleanup function
		return () => clearInterval(intervalId);
	}
}