import m from "mithril"
import { type Vnode } from "mithril"
import { ViewController as Controller } from "./controller"
import { groupIsEncrypted } from "../model/group"
import { htmlToText } from "../service/utils"
import { Modal } from "./modal"
import { synthClick } from "./utils"

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

		// The stored content is sanitized HTML; edit it as plain text
		vnode.state.content = htmlToText(vnode.attrs.controller.message.content)
	}

	view(vnode: EditMessageVnode) {

		// Use the gold "success" button for unencrypted groups, matching the other
		// unencrypted-message action buttons; encrypted groups keep the primary blue.
		const isEncrypted = groupIsEncrypted(vnode.attrs.controller.groupStream())
		const saveButtonClass = isEncrypted ? "primary" : "success"
		const textareaClass = isEncrypted ? "" : "unencrypted-textbox"

		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							<i class="bi bi-pencil-square"></i> Edit Message
						</div>
						<div class="layout-elements">
							<div class="layout-element">
								<textarea rows="8" tabindex="0" class={textareaClass} value={vnode.state.content} oninput={(event: Event) => this.setMessage(vnode, event)}></textarea>
								<div class="text-sm text-gray">Changes will be sent to all participants, but some apps may not display edits.</div>
							</div>
						</div>
					</div>
					<div class="margin-top flex-row">
						<div class="flex-grow">
							<button class={saveButtonClass} tabindex="0">{isEncrypted ? null : <i class="bi bi-chat-fill"></i>} Save Changes</button>
							<button onclick={vnode.attrs.close} tabIndex="0">Close</button>
						</div>
						<div>
							<span class="text-red" role="button" tabIndex="0" onclick={() => this.delete(vnode)} onkeypress={synthClick}>Delete</span>
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
		const message = controller.message!

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
