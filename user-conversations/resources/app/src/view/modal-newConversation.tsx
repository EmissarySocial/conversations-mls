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
	wantEncryption: boolean
	sending: boolean
}

export class NewConversation {

	oninit(vnode: NewConversationVnode) {
		vnode.state.actors = []
		vnode.state.content = ""
		vnode.state.canBeEncrypted = false
		vnode.state.wantEncryption = true
		vnode.state.sending = false
	}

	view(vnode: NewConversationVnode) {

		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							<i class="bi bi-plus"></i> Start a Conversation
						</div>
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
								{
									(vnode.state.canBeEncrypted &&
										<label for="wantEncryption">
											<input id="wantEncryption" type="checkbox" checked={vnode.state.wantEncryption} onchange={(event: Event) => this.setWantEncryption(vnode, event)} />
											Use Encrypted Messaging
										</label>
									)
								}
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

	description(vnode: NewConversationVnode): JSX.Element {
		if (vnode.state.actors.length == 0) {
			return <></>
		}

		if (vnode.attrs.controller.useEncryptedMessages() == false) {
			return <>Encrypted messages are disabled. This message will be sent as "plain text" and may be readable by others on the Internet.</>
		}

		if (vnode.state.canBeEncrypted) {

			if (vnode.state.wantEncryption) {

				return <>
					Encrypted messages cannot be read by anyone other than the recipients. But, conversations may not be recoverable if you lose access to this device.
				</>
			}

			return <>If you disable encryption, conversations will be easier to recover when you change devices, but others on the Internet may be able to intercept your messages.</>
		}

		return <>One or more recipients (shown above in green) cannot participate in encrypted conversations. Others on the Internet may be able to intercept your messages.</>
	}

	submitButton(vnode: NewConversationVnode): JSX.Element {

		if (vnode.state.sending) {
			return (
				<button class="primary" disabled>
					<span class="spin"><i class="bi bi-arrow-clockwise"></i></span> Sending
				</button>
			)
		}


		if (vnode.state.actors.length == 0) {
			return (
				<button type="submit" class="primary" disabled>
					Start a Conversation
				</button>
			)
		}

		if (this.isEncrypted(vnode)) {

			return (
				<button type="submit" class="primary" tabIndex="0">
					<i class="bi bi-lock-fill"></i> Send Encrypted Message
				</button>
			)
		}

		return (
			<button type="submit" class="success" tabIndex="0">
				<i class="bi bi-card-text"></i> Send Direct Message
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

	setWantEncryption(vnode: NewConversationVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.wantEncryption = target.checked
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

		// Give visual feedback and disable the "send" button
		vnode.state.sending = true

		// Collect variables
		const participants = vnode.state.actors.map((actor) => actor.id())
		const controller = vnode.attrs.controller

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Create a new group and send an encrypted message
		const group = await controller.createGroup(participants, vnode.state.content, this.isEncrypted(vnode))
		return this.close(vnode)
	}

	isEncrypted(vnode: NewConversationVnode): boolean {
		return vnode.state.canBeEncrypted && vnode.state.wantEncryption
	}

	// close resets the component state and closes the modal dialog
	close(vnode: NewConversationVnode) {
		vnode.state.actors = []
		vnode.state.content = ""
		vnode.attrs.close()
	}

}
