import m from "mithril"
import { type Vnode } from "mithril"
import { type Group } from "../model/group"
import { ViewController } from "./controller"
import { NewConversation } from "./modal-newConversation"
import { Groups } from "./groups"
import { GroupMessages } from "./group-messages"
import { GroupNotes } from "./group-notes"
import { GroupMembers } from "./group-members"
import { Empty } from "./empty"
import { AddGroupMember } from "./modal-addGroupMember"
import { EditMessage } from "./modal-editMessage"
import { MessageHistory } from "./modal-messageHistory"
import { PickEmoji } from "./modal-pickEmoji"
import { Attachments } from "./modal-attachments"
import { GroupWelcome } from "./group-welcome"
import { isNarrow } from "./responsive"

type IndexVnode = Vnode<IndexAttrs, IndexState>

type IndexAttrs = {
	controller: ViewController
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

		const controller = vnode.attrs.controller

		// Responsive layout is decided HERE, not in CSS: on a narrow viewport we mount
		// a single pane (the conversation list when nothing is open, otherwise the
		// detail), so the other pane simply does not exist in the DOM. On a wide
		// viewport we mount both, side by side. This makes the broken half-collapsed
		// states impossible by construction (nothing to mis-show or override).
		const narrow = isNarrow()
		const showSidebar = !narrow || !controller.hasDetail
		const showDetail = !narrow || controller.hasDetail

		return (
			<div id="conversations">
				{showSidebar &&
					<div id="app-sidebar" class="table no-top-border flex-shrink-0">
						<Groups controller={controller}></Groups>
					</div>
				}
				{showDetail && this.viewDetails(vnode)}
				{this.viewModals(vnode)}
			</div>
		)
	}

	private viewDetails(vnode: IndexVnode): JSX.Element {

		const controller = vnode.attrs.controller
		const group = controller.groupStream()

		// If no group is selected, show the empty page. The selected group is shown
		// even when it is filtered out of the sidebar list, so this depends on the
		// selection (empty id) rather than on the sidebar list being empty.
		if (group.id == "") {
			return <Empty controller={controller} />
		}

		// Special case: if the group state is "WELCOME", then only show the welcome page.
		if (group.stateId == "WELCOME") {
			return <GroupWelcome controller={controller} />
		}

		// Otherwise, show the user's selected page
		switch (vnode.attrs.controller.pageView) {

			case "GROUP-MEMBERS":
				return <GroupMembers controller={vnode.attrs.controller} />

			case "GROUP-NOTES":
				return <GroupNotes controller={vnode.attrs.controller} />

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

			case "MESSAGE-START-REACTION":
				return <PickEmoji onselect={controller.modal_startReaction_callback} close={() => this.closeModal(vnode)} />

			case "MESSAGE-HISTORY":
				return <MessageHistory controller={controller} close={() => this.closeModal(vnode)} />

			case "NEW-CONVERSATION":
				return <NewConversation controller={controller} close={() => this.closeModal(vnode)} />

			case "ATTACHMENTS":
				return <Attachments controller={controller} close={() => this.closeModal(vnode)} />

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
