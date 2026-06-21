import m, { type Vnode } from "mithril"
import type { ViewController as Controller } from "./controller"
import type { EmojiKey } from "../model/emoji"
import { synthClick } from "./utils"
import { SavedNotice } from "./widget-saved-notice"
import { Toggle } from "./widget-toggle"

type GeneralVnode = Vnode<GeneralArgs, GeneralState>

interface GeneralArgs {
	controller: Controller
}

interface GeneralState {
	isDesktopNotifications: boolean
	isSoundNotifications: boolean
	isHideOnBlur: boolean
	isEncryptedMessages: boolean
	emojiKey: EmojiKey[]
	permission: "granted" | "denied" | "default"
	saved: boolean
	savedTimeout?: ReturnType<typeof setTimeout>
}

// AppSettingsGeneral renders the "General" settings tab, which gathers the
// notification preferences and the encryption preference (plus this device's
// EmojiKey). Every change is saved automatically as soon as a control is
// toggled, and a single transient "Changes saved" notice is shown in the header.
export class AppSettingsGeneral {

	oninit(vnode: GeneralVnode) {

		const config = vnode.attrs.controller.config
		vnode.state.isDesktopNotifications = config.isDesktopNotifications
		vnode.state.isSoundNotifications = config.isSoundNotifications
		vnode.state.isHideOnBlur = config.isHideOnBlur
		vnode.state.isEncryptedMessages = config.isEncryptedMessages
		vnode.state.permission = Notification.permission
		vnode.state.saved = false

		// Load the EmojiKey from the stored KeyPackage (if one exists)
		vnode.state.emojiKey = []
		vnode.attrs.controller.loadKeyPackage().then(keyPackage => {
			vnode.state.emojiKey = keyPackage?.emojiKey ?? []
			m.redraw()
		})
	}

	onremove(vnode: GeneralVnode) {
		if (vnode.state.savedTimeout != undefined) {
			clearTimeout(vnode.state.savedTimeout)
		}
	}

	view(vnode: GeneralVnode) {

		return (
			<div>
				<div class="flex-row flex-align-center margin-bottom">
					<div class="text-lg bold flex-grow">General</div>
					<SavedNotice saved={vnode.state.saved} />
				</div>

				{this.viewNotifications(vnode)}

				<hr class="margin-vertical" />

				{this.viewEncryption(vnode)}
			</div>
		)
	}

	// viewNotifications renders the desktop/sound/focus notification preferences.
	viewNotifications(vnode: GeneralVnode): JSX.Element {

		const desktopDenied = (vnode.state.permission === "denied")

		return (
			<div class="layout-vertical">
				<div class="layout-elements">

					<div class="layout-element">
						<Toggle
							value={vnode.state.isDesktopNotifications}
							text={desktopDenied ? "Desktop Notifications Denied" : "Allow Desktop Notifications"}
							disabled={desktopDenied}
							onchange={(next: boolean) => this.setDesktopNotifications(vnode, next)} />
						{desktopDenied && <div class="text-xs text-gray margin-top-xs">To re-enable desktop notifications, go to your browser settings.</div>}
					</div>

					<div class="layout-element flex-row">
						<Toggle
							value={vnode.state.isSoundNotifications}
							text="Play Sound for New Messages"
							onchange={(next: boolean) => this.setSoundNotifications(vnode, next)} />
					</div>

					<div class="layout-element flex-row">
						<Toggle
							value={vnode.state.isHideOnBlur}
							text="Hide When Window Loses Focus"
							onchange={(next: boolean) => this.setHideOnBlur(vnode, next)} />
					</div>

				</div>
			</div>
		)
	}

	// viewEncryption renders the encryption toggle and, when enabled, the EmojiKey.
	viewEncryption(vnode: GeneralVnode): JSX.Element {

		return (
			<div>
				<div class="text-lg bold margin-top-lg margin-bottom">Encrypted Messaging</div>

				<div class="layout-vertical">
					<div class="layout-elements">

						<div class="layout-element flex-row">
							<Toggle
								value={vnode.state.isEncryptedMessages}
								text="Send Encrypted Messages When Possible"
								onchange={(next: boolean) => this.setEncryptedMessages(vnode, next)} />
						</div>

					</div>
				</div>

				{vnode.state.isEncryptedMessages && this.viewEmojiKey(vnode)}
			</div>
		)
	}

	// viewEmojiKey renders the EmojiKey, shown only when encrypted messaging is enabled
	viewEmojiKey(vnode: GeneralVnode): JSX.Element {

		const controller = vnode.attrs.controller

		return (
			<div class="margin-top card padding">
				<div class="bold margin-bottom">EmojiKeys</div>
				<div class="margin-bottom-lg">
					EmojiKeys give you an easy way to verify your identity.
					When you join a conversation from a new device, you can prove that your encryption keys match by comparing this EmojiKey.
					EmojiKey change frequently, so make sure you're comparing the most recent one.
					{" "}
					<span role="link" class="link" tabIndex="0" onclick={() => controller.host_keyPackages()} onkeypress={synthClick}>View all registered devices &rarr;</span>
				</div>

				<div class="flex-row">
					{vnode.state.emojiKey.map(([emoji, name]) => (
						<div key={emoji} class="layout-vertical align-center padding-horizontal">
							<div style="font-size: 32px; line-height:1em;">{emoji}</div>
							<div class="text-xs text-gray">{name}</div>
						</div>
					))}
				</div>
			</div>
		)
	}

	async setDesktopNotifications(vnode: GeneralVnode, value: boolean) {

		if (value) {
			const permission = await Notification.requestPermission()
			vnode.state.permission = permission
			vnode.state.isDesktopNotifications = (permission == "granted")
			this.save(vnode)
			m.redraw()
			return
		}

		vnode.state.isDesktopNotifications = false
		this.save(vnode)
	}

	setSoundNotifications(vnode: GeneralVnode, value: boolean) {
		vnode.state.isSoundNotifications = value
		this.save(vnode)
	}

	setHideOnBlur(vnode: GeneralVnode, value: boolean) {
		vnode.state.isHideOnBlur = value
		this.save(vnode)
	}

	setEncryptedMessages(vnode: GeneralVnode, value: boolean) {
		vnode.state.isEncryptedMessages = value
		this.save(vnode)
	}

	// save applies the current values to the config, persists them, and shows the
	// transient "Changes saved" notice for two seconds.
	save(vnode: GeneralVnode) {

		const controller = vnode.attrs.controller
		controller.config.isDesktopNotifications = vnode.state.isDesktopNotifications
		controller.config.isSoundNotifications = vnode.state.isSoundNotifications
		controller.config.isHideOnBlur = vnode.state.isHideOnBlur
		controller.config.isEncryptedMessages = vnode.state.isEncryptedMessages
		controller.saveConfig()

		// Show the "Changes saved" confirmation and hide it again after two seconds
		vnode.state.saved = true

		if (vnode.state.savedTimeout != undefined) {
			clearTimeout(vnode.state.savedTimeout)
		}

		vnode.state.savedTimeout = setTimeout(() => {
			vnode.state.saved = false
			m.redraw()
		}, 2000)
	}
}
