import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { type APActor } from "../model/ap-actor"
import { Modal } from "./modal"
import { ActorSearch } from "./widget-actorSearch"
import { Actor } from "../as/actor"
import { Collection } from "../as/collection"

type NewConversationVnode = Vnode<NewConversationAttrs, NewConversationState>

interface NewConversationAttrs {
	controller: Controller
	close: () => void
}

interface NewConversationState {
	actors: Actor[]
	content: string
	canBeEncrypted: boolean
}

export class NewConversation {

	oninit(vnode: NewConversationVnode) {
		vnode.state.actors = []
		vnode.state.content = ""
		vnode.state.canBeEncrypted = false
	}

	view(vnode: NewConversationVnode) {

		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						{this.header(vnode)}
						<div class="layout-elements">
							<div class="layout-element">
								<label for="">Participants</label>
								<ActorSearch
									controller={vnode.attrs.controller}
									name="actorIds"
									value={vnode.state.actors}
									endpoint="/.api/actors"
									onselect={(actors: Actor[], canBeEncrypted: boolean) => this.selectActors(vnode, actors, canBeEncrypted)}></ActorSearch>
							</div>
							<div class="layout-element">
								<label>Message</label>
								<textarea rows="8" onchange={(event: Event) => this.setPlaintext(vnode, event)}></textarea>
								<div class="text-sm text-gray">{this.description(vnode)}</div>
							</div>
						</div>
					</div>
					<div class="margin-top">
						{this.submitButton(vnode)}
						<button type="button" onclick={vnode.attrs.close} tabIndex="0">
							Close
						</button>
					</div>
				</form>
			</Modal>
		)
	}

	header(vnode: NewConversationVnode): JSX.Element {
		if (vnode.state.actors.length == 0) {
			return (
				<div class="layout-title">
					<i class="bi bi-plus"></i> Start a Conversation
				</div>
			)
		}

		if (vnode.state.canBeEncrypted) {
			return (
				<div class="layout-title">
					<i class="bi bi-shield-lock"></i> Encrypted Message
				</div>
			)
		}

		return (
			<div class="layout-title">
				<i class="bi bi-envelope-open"></i> Direct Message
			</div>
		)
	}

	description(vnode: NewConversationVnode): JSX.Element {
		if (vnode.state.actors.length == 0) {
			return <span></span>
		}

		if (vnode.state.canBeEncrypted) {
			return (
				<div>
					This will be encrypted before it leaves this device, and will not be readable by anyone other than the
					recipients.
				</div>
			)
		}

		return (
			<div>
				<i class="bi bi-exclamation-triangle-fill"></i> One or more of your recipients cannot receive encrypted
				messages. Others on the Internet may be able to read this message.
			</div>
		)
	}

	submitButton(vnode: NewConversationVnode): JSX.Element {
		if (vnode.state.actors.length == 0) {
			return (
				<button type="submit" class="primary" disabled>
					Start a Conversation
				</button>
			)
		}

		if (vnode.state.canBeEncrypted) {
			return (
				<button type="submit" class="primary" tabIndex="0">
					<i class="bi bi-lock"></i> Send Encrypted
				</button>
			)
		}

		return (
			<button type="submit" class="selected" disabled>
				Send Direct Message
			</button>
		)
	}


	// selectActors updates the selected actors when the ActorSearch component adds/removes participants
	selectActors(vnode: NewConversationVnode, actors: Actor[], canBeEncrypted: boolean) {
		vnode.state.actors = actors
		vnode.state.canBeEncrypted = canBeEncrypted
		m.redraw()
	}

	// setPlaintext updates the content message in the component state as the user types
	setPlaintext(vnode: NewConversationVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.content = target.value
	}

	// onsubmit creates a new group with the selected participants, sends the content message, and closes the dialog
	async onsubmit(event: SubmitEvent, vnode: NewConversationVnode) {

		// RULE: Do not allow submission if there is no content
		if (vnode.state.content == "") {
			return
		}

		// RULE: Do not allow submission if there are no participants
		if (vnode.state.actors.length == 0) {
			return
		}

		// Collect variables
		const participants = vnode.state.actors.map((actor) => actor.id())
		const controller = vnode.attrs.controller

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Create a new group and send an encrypted message
		const group = await controller.createGroup(participants, vnode.state.content, vnode.state.canBeEncrypted)
		return this.close(vnode)
	}

	// close resets the component state and closes the modal dialog
	close(vnode: NewConversationVnode) {
		vnode.state.actors = []
		vnode.state.content = ""
		vnode.attrs.close()
	}
}
