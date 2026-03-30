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
import { AddContact } from "./modal-addContact"
import { EditMessage } from "./modal-editMessage"
import { MessageHistory } from "./modal-messageHistory"

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
		var page: JSX.Element

		switch (vnode.attrs.controller.pageView) {

			case "GROUP-MEMBERS":
				page = <GroupMembers controller={vnode.attrs.controller} group={vnode.attrs.controller.group} />
				break

			case "GROUP-NOTES":
				page = <GroupNotes controller={vnode.attrs.controller} group={vnode.attrs.controller.group} />
				break

			case "GROUP-LEAVE":
				page = <GroupLeave controller={vnode.attrs.controller} group={vnode.attrs.controller.group} />
				break

			default:
				const groups = vnode.attrs.controller.groups
				if (groups.length == 0) {
					page = <Empty controller={vnode.attrs.controller} />
				} else {
					page = <GroupMessages controller={vnode.attrs.controller} />
				}
		}

		//
		return (
			<div id="conversations">
				<div id="app-sidebar" class="table no-top-border flex-shrink-0 scroll-vertical" style="width:30%">
					<Groups controller={vnode.attrs.controller}></Groups>
				</div>
				{page}
				{this.viewModals(vnode)}
			</div>
		)
	}

	private viewGroups(vnode: IndexVnode): JSX.Element[] {
		const controller = vnode.attrs.controller

		return controller.groups.map((group) => {
			var cssClass = "flex-row flex-align-center padding hover-trigger"

			if (group.id == controller.selectedGroupId()) {
				cssClass += " selected"
			}

			return (
				<div role="button" class={cssClass} onclick={() => controller.selectGroup(group.id)}>
					<div class="width-32 circle flex-center">
						<i class="bi bi-lock-fill"></i>
					</div>
					<div class="flex-grow nowrap ellipsis">
						<div>{group.name}</div>
						<div class="text-xs text-light-gray ellipsis-multiline-2">{group.lastMessage}</div>
					</div>
				</div>
			)
		})
	}

	// viewModals returns the JSX for the currently active modal dialog, or undefined if no modal is active
	private viewModals(vnode: IndexVnode): JSX.Element | undefined {
		const modalView = vnode.attrs.controller.modalView

		switch (modalView) {

			case "ADD-CONTACT":
				return <AddContact controller={vnode.attrs.controller} close={() => this.closeModal(vnode)} />

			case "EDIT-MESSAGE":
				return <EditMessage controller={vnode.attrs.controller} close={() => this.closeModal(vnode)} />

			case "MESSAGE-HISTORY":
				return <MessageHistory controller={vnode.attrs.controller} close={() => this.closeModal(vnode)} />

			case "NEW-CONVERSATION":
				return <NewConversation controller={vnode.attrs.controller} close={() => this.closeModal(vnode)} />

		}

		return undefined
	}

	// Global Modal Snowball
	closeModal(vnode: IndexVnode) {
		document.getElementById("modal")?.classList.remove("ready")

		window.setTimeout(() => {
			vnode.attrs.controller.modal_close()
			m.redraw()
		}, 240)
	}
}
