import m from "mithril"
import { type Vnode } from "mithril"
import { type Group } from "../model/group"
import { Controller } from "../service/controller"
import { NewConversation } from "./modal-newConversation"
import { Groups } from "./groups"
import { GroupMessages } from "./group-messages"
import { GroupNotes } from "./group-notes"
import { GroupMembers } from "./group-members"
import { GroupLeave } from "./group-leave"
import { Empty } from "./empty"
import { AddGroupMember } from "./modal-addGroupMember"
import { EditMessage } from "./modal-editMessage"
import { MessageHistory } from "./modal-messageHistory"
import { PickEmoji } from "./modal-pickEmoji"
import { GroupWelcome } from "./group-welcome"

type IndexVnode = Vnode<IndexAttrs, IndexState>

type IndexAttrs = {
	controller: Controller
}

type IndexState = {
	modal: string
	modalGroup?: Group
}

export class Index {
	oninit(vnode: IndexVnode) {
		vnode.state.modal = ""
	}

	public view(vnode: IndexVnode) {
		return (
			<div id="conversations">
				<div id="app-sidebar" class="table no-top-border flex-shrink-0 scroll-vertical" style="width:30%">
					<Groups controller={vnode.attrs.controller}></Groups>
				</div>
				{this.viewDetails(vnode)}
				{this.viewModals(vnode)}
			</div>
		)
	}

	private viewDetails(vnode: IndexVnode): JSX.Element {

		// If there are no groups, then only show the empty page.
		const groups = vnode.attrs.controller.groups

		if (groups.length == 0) {
			return <Empty controller={vnode.attrs.controller} />
		}

		// Special case: if the group state is "WELCOME", then only show the welcome page.
		const group = vnode.attrs.controller.groupStream()

		if (group.stateId == "WELCOME") {
			return <GroupWelcome controller={vnode.attrs.controller} />
		}

		// Otherwise, show the user's selected page
		switch (vnode.attrs.controller.pageView) {

			case "GROUP-MEMBERS":
				return <GroupMembers controller={vnode.attrs.controller} />

			case "GROUP-NOTES":
				return <GroupNotes controller={vnode.attrs.controller} />

			case "GROUP-LEAVE":
				return <GroupLeave controller={vnode.attrs.controller} />

			case "GROUP-MESSAGES":
			default: {
				return <GroupMessages controller={vnode.attrs.controller} />
			}
		}
	}

	// viewModals returns the JSX for the currently active modal dialog, or undefined if no modal is active
	private viewModals(vnode: IndexVnode): JSX.Element | undefined {
		const controller = vnode.attrs.controller
		const modalView = controller.modalView

		switch (modalView) {

			case "ADD-GROUP-MEMBER":
				return <AddGroupMember controller={controller} close={() => this.closeModal(vnode)} />

			case "EDIT-MESSAGE":
				return <EditMessage controller={controller} close={() => this.closeModal(vnode)} />

			case "MESSAGE-SEND-EMOJI":
				return <PickEmoji controller={controller} onselect={controller.modal_sendEmoji_callback} close={() => this.closeModal(vnode)} />

			case "MESSAGE-START-REACTION":
				return <PickEmoji controller={controller} onselect={controller.modal_startReaction_callback} close={() => this.closeModal(vnode)} />

			case "MESSAGE-HISTORY":
				return <MessageHistory controller={controller} close={() => this.closeModal(vnode)} />

			case "NEW-CONVERSATION":
				return <NewConversation controller={controller} close={() => this.closeModal(vnode)} />

		}

		return undefined
	}

	// Global Modal Snowball
	closeModal(vnode: IndexVnode) {
		document.getElementById("modal")?.classList.remove("ready")

		globalThis.setTimeout(() => {
			vnode.attrs.controller.modal_close()
			m.redraw()
		}, 240)
	}
}
