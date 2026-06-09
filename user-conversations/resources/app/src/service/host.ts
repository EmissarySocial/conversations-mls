// Quick and dirty wrapper for htmx, which the host app is guaranteed to have running.
// If you're using a non-Emissary host app, then you'll need to redefine these host bindings.
declare const htmx: {
	ajax(method: string, url: string): void
}

// Host defines all of the bindings between this Conversations app and the host web page.
// This component is built to work with default Emissary routes.
export class Host {

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

	//////////////////////////////////////////
	// State Watcher
	//////////////////////////////////////////

	watchSignin = (stop: (message: string) => void) => {

		// If the cookieStore API is available, use it
		// to listen for Application state changes
		if (typeof cookieStore !== "undefined") {
			cookieStore.addEventListener("change", async () => {
				stop("COOKIES-CHANGED")
			})

			// Since we're using the cookieStore API, we're done here.
			return
		}

		// Fall through means that we need to poll this on our own
		const originalCookie = document.cookie;

		const intervalId = setInterval(() => {
			if (document.cookie !== originalCookie) {
				stop("COOKIES-CHANGED")
			}
		}, 1000);

		// Return a cleanup function
		return () => clearInterval(intervalId);
	}
}