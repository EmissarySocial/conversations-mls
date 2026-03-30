import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { type APActor } from "../model/ap-actor"
import { Modal } from "./modal"
import { ActorSearch } from "./widget-actorSearch"
import { allActorsHaveKeyPackages } from "./utils"

type AddContactVnode = Vnode<AddContactAttrs, AddContactState>

interface AddContactAttrs {
	controller: Controller
	close: () => void
}

interface AddContactState {
	actors: APActor[]
	encrypted: boolean
}

export class AddContact {

	oninit(vnode: AddContactVnode) {
		vnode.state.actors = []
		vnode.state.encrypted = false
	}

	view(vnode: AddContactVnode) {
		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						{this.header(vnode)}
						<div class="layout-elements">
							<div class="layout-element">
								<label for="actorIds">Add People</label>
								<ActorSearch
									name="actorIds"
									value={vnode.state.actors}
									endpoint="/.api/actors"
									position="relative"
									onselect={(actors: APActor[]) => this.selectActors(vnode, actors)}>
								</ActorSearch>
							</div>
						</div>
					</div>
					<div class="margin-top">
						{this.submitButton(vnode)}
						<button onclick={vnode.attrs.close} tabIndex="0">
							Close
						</button>
					</div>
				</form>
			</Modal>
		)
	}

	header(vnode: AddContactVnode): JSX.Element {

		if (vnode.state.encrypted) {
			return (
				<div class="layout-title">
					<i class="bi bi-shield-lock"></i> Add People to this Encrypted Conversation
				</div>
			)
		}

		return (
			<div class="layout-title">
				<i class="bi bi-envelope-open"></i> Add People to this Conversation
			</div>
		)
	}

	description(vnode: AddContactVnode): JSX.Element {

		if (vnode.state.encrypted) {
			return (
				<div>
					To be added to this conversation, new recipients must be able to send and receive encrypted messages.
				</div>
			)
		}

		return (
			<div>
				Anyone on the Fediverse can be added to this conversation, but messages will not be encrypted.
			</div>
		)
	}

	submitButton(vnode: AddContactVnode): JSX.Element {

		if (vnode.state.encrypted) {

			if (allActorsHaveKeyPackages(vnode.state.actors)) {
				return (
					<button type="submit" class="primary" tabIndex="0">
						<i class="bi bi-lock"></i> Add People to Conversation
					</button>
				)
			}

			return (
				<button class="primary" tabIndex="0" disabled>
					<i class="bi bi-lock"></i> Add People to Conversation
				</button>
			)
		}

		return (
			<button class="primary" disabled>
				Add People to Conversation
			</button>
		)
	}

	selectActors(vnode: AddContactVnode, actors: APActor[]) {
		vnode.state.actors = actors

		if (actors.some((actor) => actor["mls:keyPackages"] == "")) {
			vnode.state.encrypted = false
		} else {
			vnode.state.encrypted = true
		}
	}

	async onsubmit(event: SubmitEvent, vnode: AddContactVnode) {
		//
		// Collect variables
		const participants = vnode.state.actors.map((actor) => actor.id)
		const controller = vnode.attrs.controller

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Create a new conversation and send plaintext message
		await controller.addContacts(participants)
		return this.close(vnode)
	}

	close(vnode: AddContactVnode) {
		vnode.state.actors = []
		vnode.attrs.close()
	}
}
