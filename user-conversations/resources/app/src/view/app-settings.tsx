import m, { type Vnode } from "mithril"
import type { Group } from "../model/group"
import type { Controller } from "../service/controller"
import { haltEvent } from "./utils"
import { emojiKey } from "../service/emojikeys"

type AppSettingsVnode = Vnode<AppSettingsArgs, AppSettingsState>

interface AppSettingsArgs {
	controller: Controller
	group: Group
}

interface AppSettingsState {
	name: string
	passcode: string
	isEncryptedMessages: boolean
	isDesktopNotifications: boolean
	isDesktopNotificationsPermission: "granted" | "denied" | "default"
	isHideOnBlur: boolean
}

export class AppSettings {

	oninit(vnode: AppSettingsVnode) {
		const controller = vnode.attrs.controller

		vnode.state.name = controller.config.generatorName
		vnode.state.isHideOnBlur = controller.config.isHideOnBlur
		vnode.state.isEncryptedMessages = controller.config.isEncryptedMessages
		vnode.state.isDesktopNotifications = controller.config.isDesktopNotifications
		vnode.state.isDesktopNotificationsPermission = Notification.permission
	}

	view(vnode: AppSettingsVnode) {

		const controller = vnode.attrs.controller

		return (
			<div id="conversations" class="app-content">
				<div class="padding width-800">
					<div class="flex-row flex-align-center margin-bottom">
						<div class="clickable circle width-32 margin-none flex-center" onclick={() => controller.page_index()} tabIndex="0"><i class="bi bi-arrow-left"></i></div>
						<div class="text-lg bold margin-none">Conversation Settings</div>
					</div>

					<div class="card padding">
						<form onsubmit={(event: SubmitEvent) => this.submit(event, vnode)}>
							<div class="layout-vertical">
								<div class="layout-elements">

									<div class="layout-element flex-row">
										<input type="checkbox" tabIndex="0" id="isEncryptedMessages" checked={vnode.state.isEncryptedMessages} onchange={(event: Event) => this.setEncryptedMessages(vnode, event)} style="height:1em; width:1em;" />
										<label for="isEncryptedMessages">
											<div>Send Encrypted Messages When Possible</div>
										</label>
									</div>

									<div class="layout-element flex-row">
										<input type="checkbox" id="isHideOnBlur" checked={vnode.state.isHideOnBlur} onchange={(event: Event) => this.setHideOnBlur(vnode, event)} style="height:1em; width:1em;" />
										<label for="isHideOnBlur">
											<div>Hide When Window Loses Focus</div>
										</label>
									</div>

									<div class="layout-element flex-row">
										<input type="checkbox" id="isDesktopNotifications" checked={vnode.state.isDesktopNotifications} disabled={vnode.state.isDesktopNotificationsPermission === "denied"} onchange={(event: Event) => this.setDesktopNotifications(vnode, event)} style="height:1em; width:1em;" />
										<label for="isDesktopNotifications">
											<div>{(vnode.state.isDesktopNotificationsPermission != "denied") ? "Allow Desktop Notifications" : "Desktop Notifications Denied"}</div>
											{vnode.state.isDesktopNotificationsPermission === "denied" && <div class="text-xs text-gray margin-right-xs">To re-enable desktop notifications, go to your browser settings.</div>}
										</label>
									</div>

								</div>
							</div>

							<button type="submit" class="primary">Save Settings</button>
							<button onclick={() => controller.page_index()}>Cancel</button>
						</form>
					</div>

					<div class="card padding margin-top">
						<div class="text-lg bold margin-bottom">EmojiKey</div>
						<div class="margin-bottom-lg">
							EmojiKeys give you an easy way to verify your identity.
							When you join a conversation from a new device, you can prove that your encryption keys match by comparing this EmojiKey.
							EmojiKey change frequently, so make sure you're comparing the most recent one.
							{" "}
							<span class="link" tabIndex="0" onclick={() => controller.host_keyPackages()}>View all registered devices &rarr;</span>
						</div>

						<div class="flex-row">
							{controller.emojiKey.map(([emoji, name]) => (
								<div class="layout-vertical align-center padding-horizontal">
									<div style="font-size: 32px; line-height:1em;">{emoji}</div>
									<div class="text-xs text-gray">{name}</div>
								</div>
							))}
						</div>
					</div>

					<div class="card padding margin-top">
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

					<div class="padding-vertical-xl"></div>
				</div>
			</div>
		)
	}

	setEncryptedMessages(vnode: AppSettingsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isEncryptedMessages = target.checked
	}

	async setDesktopNotifications(vnode: AppSettingsVnode, event: Event) {
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

	setHideOnBlur(vnode: AppSettingsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
	}

	submit(event: SubmitEvent, vnode: AppSettingsVnode) {

		// Halt form submission and page reload
		haltEvent(event)

		// Save the configuration
		const controller = vnode.attrs.controller
		controller.saveConfiguration(
			vnode.state.name,
			vnode.state.passcode,
			vnode.state.isEncryptedMessages,
			vnode.state.isDesktopNotifications,
			vnode.state.isHideOnBlur,
		)

		// Return to the message index
		vnode.attrs.controller.page_index()
	}

	eraseDevice(vnode: AppSettingsVnode) {

		if (!confirm("Encrypted messages on this device will be lost forever. Are you sure you want to erase this device?")) {
			return
		}

		vnode.attrs.controller.eraseDevice()
	}
}
