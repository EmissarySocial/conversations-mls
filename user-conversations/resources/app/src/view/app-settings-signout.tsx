import m from "mithril"
import type { ViewController as Controller } from "./controller"

type SignoutVnode = m.Vnode<SignoutArgs, SignoutState>

interface SignoutArgs {
	controller: Controller
}

interface SignoutState { }

// AppSettingsSignout renders the "Sign Out / Erase" settings tab, which lets
// the user close their current session or erase all data from this device.
export class AppSettingsSignout {

	view(vnode: SignoutVnode) {

		const controller = vnode.attrs.controller

		return (
			<div>
				<div class="card padding">
					<div class="text-lg bold margin-bottom">Close Conversations</div>
					<div class="layout-vertical margin-top">
						<div class="layout-elements">
							<div class="layout-element">
								Close out this current session.
								Your data will remain on this device, but cannot be accessed without a passcode.
							</div>
						</div>
					</div>

					<button class="text-red" onclick={() => controller.page_signout()}>Close</button>
				</div>

				<div class="card padding margin-top">
					<div class="text-lg bold margin-bottom">Erase Device</div>
					<div class="layout-vertical margin-top">
						<div class="layout-elements">
							<div class="layout-element">
								Erase all conversation data from this device.  You'll be able to recover unencrypted conversations
								on another device. But encrypted conversations will be lost forever.
							</div>
						</div>
					</div>

					<button class="text-red" onclick={() => this.eraseDevice(vnode)}>Erase Device</button>
				</div>
			</div>
		)
	}

	eraseDevice(vnode: SignoutVnode) {

		if (!confirm("Encrypted messages on this device will be lost forever. Are you sure you want to erase this device?")) {
			return
		}

		vnode.attrs.controller.eraseDevice()
	}
}
