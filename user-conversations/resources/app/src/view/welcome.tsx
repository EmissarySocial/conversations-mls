import m from "mithril"
import type { Controller } from "../service/controller"

type WelcomeVnode = m.Vnode<WelcomeAttrs, WelcomeState>

type WelcomeAttrs = {
	controller: Controller
}

type WelcomeState = {
	clientName: string
	passcode: string
	isEncryptedMessages: boolean
	isDesktopNotifications: boolean
	isDesktopNotificationsPermission: "granted" | "denied" | "default"
	isHideOnBlur: boolean
}

export class Welcome {

	oninit(vnode: WelcomeVnode) {
		vnode.state.clientName = this.defaultClientName()
		vnode.state.passcode = ""
		vnode.state.isDesktopNotifications = false
		vnode.state.isDesktopNotificationsPermission = Notification.permission
		vnode.state.isHideOnBlur = false
	}

	view(vnode: WelcomeVnode) {
		return (
			<div class="app-content">
				<div class="margin-top-xl width-100%">
					<div class="card padding-lg width-100% max-width-800 margin-horizontal-auto">
						<div class="align-center text-light-gray" style="font-size:80px;"><i class="bi bi-chat"></i></div>
						<div class="align-center text-2xl">
							Welcome to Conversations
						</div>
						<hr />
						<div class="margin-vertical-lg">
							Conversations collect all of your personal messages into a single place.{" "}
							You can send "direct messages" to any Fediverse account, and send "encrypted messages" to accounts that support it.{" "}
							<a href="https://emissary.dev/conversations" class="nowrap">
								Learn more about encrypted conversations <i class="bi bi-arrow-up-right-square"></i>
							</a>

						</div>

						<form onsubmit={(event: SubmitEvent) => this.submit(event, vnode)}>
							<div class="layout-vertical">
								<div class="layout-elements">
									<div class="layout-element">
										<label for="clientName">Device Name</label>
										<input id="clientName" type="text" tabIndex="0" value={vnode.state.clientName} oninput={(event: Event) => this.setClientName(vnode, event)} autofocus required />
										<div class="text-xs text-gray margin-right-xs">
											You can have conversations on multiple devices. Choose a unique name for this one.
										</div>
									</div>

									<div class="layout-element">
										<label for="passcode">Device Passcode</label>
										<input id="passcode" type="text" tabIndex="0" value={vnode.state.passcode} oninput={(event: Event) => this.setPasscode(vnode, event)} required />
										<div class="text-xs text-gray margin-right-xs">
											(REQUIRED) If you lose this passcode, encrypted messages cannot be recovered.
										</div>
									</div>

									<div class="layout-element flex-row">
										<input type="checkbox" tabIndex="0" id="isEncryptedMessages" checked={vnode.state.isEncryptedMessages} onchange={(event: Event) => this.setEncryptedMessages(vnode, event)} style="height:1em; width:1em;" />
										<label for="isEncryptedMessages">
											<div>Send Encrypted Messages When Possible</div>
										</label>
									</div>

									<div class="layout-element flex-row">
										<input type="checkbox" tabIndex="0" id="isHideOnBlur" checked={vnode.state.isHideOnBlur} onchange={(event: Event) => this.setHideOnBlur(vnode, event)} style="height:1em; width:1em;" />
										<label for="isHideOnBlur">
											<div>Hide Conversations When You Leave This Window</div>
										</label>
									</div>

									<div class="layout-element flex-row">
										<input type="checkbox" tabIndex="0" id="isDesktopNotifications" checked={vnode.state.isDesktopNotifications} disabled={vnode.state.isDesktopNotificationsPermission === "denied"} onchange={(event: Event) => this.setDesktopNotifications(vnode, event)} style="height:1em; width:1em;" />
										<label for="isDesktopNotifications">
											<div>{(vnode.state.isDesktopNotificationsPermission != "denied") ? "Allow Desktop Notifications" : "Desktop Notifications Denied"}</div>
											{vnode.state.isDesktopNotificationsPermission === "denied" && <div class="text-xs text-gray margin-right-xs">To re-enable desktop notifications, go to your browser settings.</div>}
										</label>
									</div>

								</div>
							</div>

							<br />
							<button type="submit" class="primary" tabIndex="0">Continue to Conversations &rarr;</button>
						</form>

					</div>
				</div>
			</div>
		)
	}

	setClientName = (vnode: WelcomeVnode, event: Event) => {
		const target = event.target as HTMLInputElement
		vnode.state.clientName = target.value
	}

	setPasscode = (vnode: WelcomeVnode, event: Event) => {
		const target = event.target as HTMLInputElement
		vnode.state.passcode = target.value
	}

	setHideOnBlur = (vnode: WelcomeVnode, event: Event) => {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
	}

	setEncryptedMessages = (vnode: WelcomeVnode, event: Event) => {
		const target = event.target as HTMLInputElement
		vnode.state.isEncryptedMessages = target.checked
	}

	setDesktopNotifications = async (vnode: WelcomeVnode, event: Event) => {
		const target = event.target as HTMLInputElement

		if (target.checked) {
			const permission = await Notification.requestPermission()
			vnode.state.isDesktopNotificationsPermission = permission

			if (permission == "granted") {
				vnode.state.isDesktopNotifications = true
				return
			}

		}

		vnode.state.isDesktopNotifications = false
	}

	async submit(event: SubmitEvent, vnode: WelcomeVnode) {

		// Halt form submission and page reload
		event.preventDefault()
		event.stopPropagation()

		// Save the configuration settings
		await vnode.attrs.controller.startupConfiguration(
			vnode.state.clientName,
			vnode.state.passcode,
			vnode.state.isEncryptedMessages,
			vnode.state.isDesktopNotifications,
			vnode.state.isHideOnBlur,
		)

		// Woot.
		m.redraw()
	}


	defaultClientName() {
		const userAgent = navigator.userAgent

		var result = "Unknown Browser"

		// Estimate the Browser Name
		if (userAgent.indexOf("Edge") != -1) {
			result = "Microsoft Edge"
		} else if (userAgent.indexOf("Chrome") != -1) {
			result = "Google Chrome"
		} else if (userAgent.indexOf("Firefox") != -1) {
			result = "Mozilla Firefox"
		} else if (userAgent.indexOf("Safari") != -1) {
			result = "Apple Safari"
		} else if (userAgent.indexOf("Opera") != -1) {
			result = "Opera"
		} else if (userAgent.indexOf("Vivaldi") != -1) {
			result = "Vivaldi"
		}

		// Estimate the OS Name
		if (userAgent.indexOf("Macintosh") != -1) {
			result += " on Macintosh"
		} else if (userAgent.indexOf("Windows") != -1) {
			result += " on Windows"
		} else if (userAgent.indexOf("Linux") != -1) {
			result += " on Linux"
		} else if (userAgent.indexOf("Android") != -1) {
			result += " on Android"
		} else if (userAgent.indexOf("iPhone") != -1) {
			result += " on iOS"
		} else if (userAgent.indexOf("iPad") != -1) {
			result += " on iPadOS"
		} else {
			result += " on Unknown OS"
		}

		return result
	}
}
