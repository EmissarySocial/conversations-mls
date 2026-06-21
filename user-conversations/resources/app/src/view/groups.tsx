import m from "mithril"
import { ViewController } from "./controller"
import { groupIsEncrypted, type Group } from "../model/group"
import { synthClick } from "./utils"
import { FilterMenu } from "./widget-filterMenu"

type GroupsVnode = m.Vnode<GroupsAttrs, GroupsState>

type GroupsAttrs = {
	controller: ViewController
}

type GroupsState = {}

export class Groups {

	view(vnode: GroupsVnode) {
		const controller = vnode.attrs.controller

		return (
			<div class="conversations-pane">
				<div class="flex-row flex-align-center padding-left">
					<div class="bold text-lg margin-none flex-grow ellipsis" style="min-width:0">{controller.selectedFilterName()}</div>
					<FilterMenu controller={controller} />
					<div class="popup-button primary" role="button" tabindex="0" title="New conversation" aria-label="New conversation" onclick={() => controller.modal_newConversation()} onkeypress={synthClick}>
						<i class="bi bi-plus-lg"></i>
					</div>
				</div>

				<hr class="margin-vertical-sm" />

				<div class="conversations-scroll">
					{controller.groups.map((group) => {
						let cssClass = "sidebar-item flex-row flex-align-center padding padding-right-sm hover-trigger"

						if (group.id == controller.selectedGroupId()) {
							cssClass += " highlight"
						}

						return (
							<div key={group.id} class={cssClass} role="button" tabIndex="0" onclick={() => controller.selectGroup(group.id)} onkeypress={synthClick}>
								<div class="width-48 circle flex-center" style={`color:var(--white); background-color:${this.groupColor(group)}`}>
									{this.groupIcon(group)}
								</div>
								<div class="flex-row flex-grow nowrap pos-relative group-list-item-body">
									<div class="flex-grow group-list-item-label">
										{this.groupLabel(group)}
									</div>
									{this.unreadMarker(vnode, group)}
								</div>
							</div>
						)
					})}
				</div>

				<hr class="margin-vertical-sm" />

				<div class="sidebar-item flex-row flex-align-center padding-horizontal clickable" role="button" tabIndex="0" onclick={() => controller.page_settings()} onkeypress={synthClick}>
					<i class="bi bi-gear"></i>
					<span>Settings</span>
				</div>
			</div>
		)
	}

	groupColor(group: Group): string {

		if (group.stateId == "WELCOME") {
			return "var(--gray50)"
		}

		if (groupIsEncrypted(group)) {
			return "var(--blue50)"
		}

		return "#F2C94C"
	}

	groupIcon(group: Group): JSX.Element {

		// Important groups show a star in place of the type icon. The avatar's color
		// (set by groupColor) still conveys the group's encryption status.
		if (group.stateId == "IMPORTANT") {
			return <i class="bi bi-star-fill"></i>
		}

		if (groupIsEncrypted(group)) {
			return <i class="bi bi-lock-fill"></i>
		}

		return <i class="bi bi-chat-fill"></i>
	}

	groupLabel(group: Group): JSX.Element {

		if (group.stateId == "WELCOME") {
			return <>
				<div class="bold">Invitation ({groupIsEncrypted(group) ? "Encrypted" : "Plaintext"})</div>
				<div class="text-xs text-light-gray ellipsis-multiline-2">{group.defaultName || ""}</div>
			</>
		}

		return <>
			<div class="flex-row flex-align-center bold">
				<span class="flex-grow ellipsis" style="min-width:0">{group.name || group.defaultName || ""}</span>
			</div>
			<div class="text-xs text-light-gray ellipsis-multiline-2">{group.lastMessage || ""}</div>
		</>
	}

	unreadMarker(vnode: GroupsVnode, group: Group) {

		// Only display the marker if the group is unread
		if (!group.unread) {
			return null
		}

		// A group in the WELCOME state is a pending invitation, not an active
		// conversation, so it does not show an unread-messages indicator.
		if (group.stateId == "WELCOME") {
			return null
		}

		// Encrypted groups use the blue accent; plaintext groups use the gold
		// unencrypted accent (#F2C94C), matching the rest of the app.
		const color = groupIsEncrypted(group) ? "var(--blue50)" : "#F2C94C"

		return <div class="text-xs group-list-item-unread" style={`color:${color};`}>
			<i class="bi bi-circle-fill"></i>
		</div>
	}
}
