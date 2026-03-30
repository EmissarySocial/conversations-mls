import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { type APActor } from "../model/ap-actor"
import { Modal } from "./modal"

type EditMessageVnode = Vnode<EditMessageAttrs, EditMessageState>

interface EditMessageAttrs {
	controller: Controller
	close: () => void
}

interface EditMessageState {
	plaintext: string
}

export class EditMessage {

	oninit(vnode: EditMessageVnode) {
		vnode.state.plaintext = vnode.attrs.controller.message.plaintext
	}

	view(vnode: EditMessageVnode) {
		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							<i class="bi bi-pencil-square"></i> Edit Message
						</div>
						<div class="layout-elements">
							<div class="layout-element">
								<textarea rows="8" value={vnode.state.plaintext} oninput={(event: Event) => this.setMessage(vnode, event)}></textarea>
								<div class="text-sm text-gray">Changes will be sent to all participants, but may not be visible in some apps.</div>
							</div>
						</div>
					</div>
					<div class="margin-top">
						<button class="primary" tabindex="0">Save Changes</button>
						<button onclick={vnode.attrs.close} tabIndex="0">Close</button>
					</div>
				</form>
			</Modal>
		)
	}

	setMessage(vnode: EditMessageVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.plaintext = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: EditMessageVnode) {

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Collect variables
		const controller = vnode.attrs.controller
		var message = controller.message

		// Update the message content
		message.plaintext = vnode.state.plaintext

		// Save the message (and send Updates to participants)
		await controller.updateMessage(message)
		return this.close(vnode)
	}

	close(vnode: EditMessageVnode) {
		vnode.attrs.controller.clearMessage()
		vnode.attrs.close()
	}
}
