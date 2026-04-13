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
	content: string
}

export class EditMessage {

	oninit(vnode: EditMessageVnode) {

		if (vnode.attrs.controller.message == undefined) {
			throw new Error("No message selected for editing")
		}

		vnode.state.content = vnode.attrs.controller.message.content
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
								<textarea rows="8" value={vnode.state.content} oninput={(event: Event) => this.setMessage(vnode, event)}></textarea>
								<div class="text-sm text-gray">Changes will be sent to all participants, but some apps may not display edits.</div>
							</div>
						</div>
					</div>
					<div class="margin-top flex-row">
						<div class="flex-grow">
							<button class="primary" tabindex="0">Save Changes</button>
							<button onclick={vnode.attrs.close} tabIndex="0">Close</button>
						</div>
						<div>
							<span role="button" class="text-red" tabIndex="0" onclick={() => this.delete(vnode)}>Delete</span>
						</div>
					</div>
				</form>
			</Modal>
		)
	}

	setMessage(vnode: EditMessageVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.content = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: EditMessageVnode) {

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Collect variables
		const controller = vnode.attrs.controller
		var message = controller.message!

		// Update the message content
		message.content = vnode.state.content

		// Save the message (and send Updates to participants)
		await controller.updateMessage(message)
		return this.close(vnode)
	}


	delete(vnode: EditMessageVnode) {

		const message = vnode.attrs.controller.message

		if (message == undefined) {
			throw new Error("No message selected for deletion")
		}

		if (confirm("Are you sure you want to delete this message?")) {
			vnode.attrs.controller.deleteMessage(message.id)
			vnode.attrs.controller.modal_close()
		}
	}


	close(vnode: EditMessageVnode) {
		vnode.attrs.controller.clearMessage()
		vnode.attrs.close()
	}
}
