import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { Modal } from "./modal"
import { ActorSearch } from "./widget-actorSearch"
import { Actor } from "../as/actor"
import { groupIsEncrypted, type Group } from "../model/group"

type AddGroupMemberVnode = Vnode<AddGroupMemberAttrs, AddGroupMemberState>

interface AddGroupMemberAttrs {
	controller: Controller
	close: () => void
}

interface AddGroupMemberState {
	actors: Actor[]
	canBeEncrypted: boolean
}

export class AddGroupMember {

	oninit(vnode: AddGroupMemberVnode) {
		vnode.state.actors = []
		vnode.state.canBeEncrypted = false
	}

	view(vnode: AddGroupMemberVnode) {

		const group = vnode.attrs.controller.groupStream()
		const isEncrypted = groupIsEncrypted(group)

		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							<i class={isEncrypted ? "bi bi-shield-lock" : "bi bi-envelope-open"}></i> Add People to this Conversation
						</div>

						<div class="margin-bottom">
							{isEncrypted
								? "To be added to this conversation, new recipients must be able to send and receive encrypted messages."
								: "Anyone on the Fediverse can be added to this conversation, but messages will not be encrypted."
							}
						</div>

						<div class="layout-elements">
							<div class="layout-element">
								<label for="actorIds">Add People</label>
								<ActorSearch
									controller={vnode.attrs.controller}
									name="actorIds"
									value={vnode.state.actors}
									endpoint="/.api/actors"
									position="relative"
									onselect={(actors: Actor[], canBeEncrypted: boolean) => this.selectActors(vnode, actors, canBeEncrypted)} >
								</ActorSearch>
							</div>
						</div>
					</div>
					{this.submitButton(vnode)}
				</form>
			</Modal >
		)
	}

	submitButton(vnode: AddGroupMemberVnode): JSX.Element {

		const group = vnode.attrs.controller.groupStream()
		const isEncrypted = groupIsEncrypted(group)

		if (vnode.state.actors.length == 0) {
			return (
				<div class="margin-top">
					<button type="submit" class="primary" disabled>
						{isEncrypted ? <i class="bi bi-shield-lock"></i> : <i class="bi bi-envelope-open"></i>} {" "}
						Add People to Conversation
					</button>
					<button onclick={vnode.attrs.close} tabIndex="0">
						Close
					</button>
					<div class="text-xs text-gray">
						Enter one or more people to add to this conversation
					</div>
				</div>
			)
		}


		if (isEncrypted) {

			return (
				<div class="margin-top">
					<button type="submit" class="primary" tabIndex="0" disabled={!vnode.state.canBeEncrypted}>
						<i class="bi bi-lock"></i> Add People to Conversation
					</button>
					<button onclick={vnode.attrs.close} tabIndex="0">
						Close
					</button>
					{!vnode.state.canBeEncrypted && (
						<div class="text-xs text-gray">
							Some people don't support encrypted chats.
						</div>
					)}
				</div>
			)
		}

		return (
			<div class="margin-top">
				<button class="primary" tabIndex="0" disabled>
					<i class="bi bi-envelope-open"></i> Add People to Conversation
				</button>
				<button onclick={vnode.attrs.close} tabIndex="0">
					Close
				</button>
			</div>
		)
	}

	selectActors(vnode: AddGroupMemberVnode, actors: Actor[], canBeEncrypted: boolean) {
		vnode.state.actors = actors
		vnode.state.canBeEncrypted = canBeEncrypted
		m.redraw()
	}

	async onsubmit(event: SubmitEvent, vnode: AddGroupMemberVnode) {

		// Collect variables
		const participants = vnode.state.actors.map((actor) => actor.id())
		const controller = vnode.attrs.controller

		// Swallow this event
		event.preventDefault()
		event.stopPropagation()

		// Create a new conversation and send plaintext message
		await controller.addGroupMembers(participants)
		return this.close(vnode)
	}

	close(vnode: AddGroupMemberVnode) {
		vnode.state.actors = []
		vnode.attrs.close()
	}
}
