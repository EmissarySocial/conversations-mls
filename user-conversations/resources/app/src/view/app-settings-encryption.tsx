import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import type { EmojiKey } from "../model/emoji"
import { synthClick } from "./utils"
import { SavedNotice } from "./widget-saved-notice"

type EncryptionVnode = Vnode<EncryptionArgs, EncryptionState>

interface EncryptionArgs {
	controller: Controller
	save: () => void
	saved: boolean
}

interface EncryptionState {
	isEncryptedMessages: boolean
	emojiKey: EmojiKey[]
}

// AppSettingsEncryption renders the "Encryption" settings tab, which controls
// whether messages are sent encrypted and displays this device's EmojiKey.
// Edits are held in local state and only applied to the config when the user
// clicks "Save Changes".
export class AppSettingsEncryption {

	oninit(vnode: EncryptionVnode) {

		vnode.state.isEncryptedMessages = vnode.attrs.controller.config.isEncryptedMessages

		// Load the EmojiKey from the stored KeyPackage (if one exists)
		vnode.state.emojiKey = []
		vnode.attrs.controller.loadKeyPackage().then(keyPackage => {
			vnode.state.emojiKey = keyPackage?.emojiKey ?? []
			m.redraw()
		})
	}

	view(vnode: EncryptionVnode) {

		const controller = vnode.attrs.controller

		return (
			<div>
				<div class="card padding">
					<div class="text-lg bold margin-bottom">Encryption</div>

					<div class="layout-vertical">
						<div class="layout-elements">

							<div class="layout-element flex-row">
								<input type="checkbox" tabIndex="0" id="isEncryptedMessages" checked={vnode.state.isEncryptedMessages} onchange={(event: Event) => this.setEncryptedMessages(vnode, event)} style="height:1em; width:1em;" />
								<label for="isEncryptedMessages"> {/* NOSONOR: typescript:S6853 */}
									<div>Send Encrypted Messages When Possible</div>
								</label>
							</div>

						</div>
					</div>

					<div class="margin-top flex-row flex-align-center">
						<button class="primary" onclick={() => this.saveChanges(vnode)}>Save Changes</button>
						<button onclick={() => controller.page_index()}>Cancel</button>
						<span class="margin-left-sm"><SavedNotice saved={vnode.attrs.saved} /></span>
					</div>
				</div>

				{vnode.state.isEncryptedMessages && this.viewEmojiKey(vnode)}
			</div>
		)
	}

	// viewEmojiKey renders the EmojiKey card, shown only when encrypted messaging is enabled
	viewEmojiKey(vnode: EncryptionVnode): JSX.Element {

		const controller = vnode.attrs.controller

		return (
			<div class="card padding margin-top">
				<div class="text-lg bold margin-bottom">EmojiKey</div>
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

	setEncryptedMessages(vnode: EncryptionVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isEncryptedMessages = target.checked
	}

	// saveChanges applies the local edits to the config and persists them
	saveChanges(vnode: EncryptionVnode) {
		vnode.attrs.controller.config.isEncryptedMessages = vnode.state.isEncryptedMessages
		vnode.attrs.save()
	}
}
