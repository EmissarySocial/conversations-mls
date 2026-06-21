import m from "mithril"
import { type Vnode } from "mithril"
import { ViewController } from "./controller"
import { Modal } from "./modal"
import { ActorSearch } from "./widget-actorSearch"
import { Actor } from "../as/actor"
import { groupIsEncrypted, groupColor } from "../model/group"

type AddGroupMemberVnode = Vnode<AddGroupMemberAttrs, AddGroupMemberState>

interface AddGroupMemberAttrs {
	controller: ViewController
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
				<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)} style={{ "--focus-color": groupColor(group) }}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							<i class="bi bi-plus"></i> Add People
						</div>

						{isEncrypted ?
							<div class="margin-bottom"><b>This is an encrypted conversation.</b> New members MUST support encrypted messaging to join.</div>
							:
							<div class="margin-bottom"><b>This is an unencrypted conversation.</b> Anyone on the Fediverse can be added to this conversation, but messages will not be encrypted.</div>
						}

						<div class="layout-elements">
							<div class="layout-element">
								<label for="actorIds">Enter Username(s)</label> {/* NOSONAR: "for" works fine in Mithril */}
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
		let disabled = (vnode.state.actors.length == 0)

		if (isEncrypted) {

			if (!vnode.state.canBeEncrypted) {
				disabled = true
			}

			return (
				<div class="margin-top">
					<button type="submit" class="primary" tabIndex="0" disabled={disabled}>
						<i class="bi bi-lock-fill"></i>
						<span>Add People (Encrypted)</span>
					</button>
					<button onclick={vnode.attrs.close} tabIndex="0">
						Close
					</button>
				</div>
			)
		}

		return (
			<div class="margin-top">
				<button type="submit" class="success" tabIndex="0" disabled={disabled}>
					<i class="bi bi-card-text"></i> Add People (Not Encrypted)
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
