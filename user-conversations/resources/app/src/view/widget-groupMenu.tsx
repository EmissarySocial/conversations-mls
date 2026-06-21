import m from "mithril"
import type { ViewController } from "./controller"
import { synthClick } from "./utils"
import { Popup } from "./widget-popup"
import { type Group, type EncryptedGroup, type GroupState } from "../model/group"

type GroupMenuVnode = m.Vnode<GroupMenuArgs, GroupMenuState>

interface GroupMenuArgs {
	controller: ViewController
	group: Group | EncryptedGroup
}

interface GroupMenuState { }

// GroupMenu is the per-conversation "···" pop-up menu shown in the conversation
// header. Its top section selects the group's state (Important / Active /
// Archived), mirroring the icon buttons beside it; the bottom section holds
// per-conversation actions (Mark Unread / Mute / Leave Group).
export class GroupMenu {

	view(vnode: GroupMenuVnode) {

		const { controller, group } = vnode.attrs

		return (
			<Popup
				align="right"
				trigger={(toggle: () => void) => (
					<div class="popup-button" role="button" tabindex="0" title="Conversation options" aria-label="Conversation options" onclick={toggle} onkeypress={synthClick}>
						<i class="bi bi-three-dots"></i>
					</div>
				)}
				content={(close: () => void) => this.viewMenu(controller, group, close)}
			/>
		)
	}

	// viewMenu renders the body of the group pop-up
	viewMenu(controller: ViewController, group: Group | EncryptedGroup, close: () => void): m.Children {

		return (
			<div>
				<div class="popup-menu-header">Status</div>
				{this.viewStateItem(controller, group, close, "IMPORTANT", "Important")}
				{this.viewStateItem(controller, group, close, "ACTIVE", "Active")}
				{this.viewStateItem(controller, group, close, "ARCHIVED", "Archived")}

				<hr class="margin-vertical-sm" />

				<div class="popup-menu-item clickable" role="button" tabIndex="0" onclick={() => this.markUnread(controller, group, close)} onkeypress={synthClick}>
					<span class="popup-menu-icon"><i class="bi bi-app-indicator"></i></span>
					<span>Mark Unread</span>
				</div>

				<div class="popup-menu-item clickable text-red" role="button" tabIndex="0" onclick={() => this.leave(controller, group, close)} onkeypress={synthClick}>
					<span class="popup-menu-icon"><i class="bi bi-x-lg"></i></span>
					<span>Leave Group</span>
				</div>
			</div>
		)
	}

	// viewStateItem renders one of the state choices, with a checkmark on the
	// group's current state.
	viewStateItem(controller: ViewController, group: Group | EncryptedGroup, close: () => void, state: GroupState, label: string): m.Children {

		const isSelected = (group.stateId == state)

		return (
			<div class="popup-menu-item clickable" role="button" tabIndex="0" onclick={() => this.selectState(controller, close, state)} onkeypress={synthClick}>
				<span class="popup-menu-icon">{isSelected ? <i class="bi bi-check"></i> : null}</span>
				<span>{label}</span>
			</div>
		)
	}

	// selectState changes the group's state and closes the pop-up
	selectState(controller: ViewController, close: () => void, state: GroupState) {
		controller.setSelectedGroupState(state)
		close()
	}

	// markUnread flags the group as unread, persists it, and closes the pop-up
	markUnread(controller: ViewController, group: Group | EncryptedGroup, close: () => void) {
		group.unread = true
		controller.saveGroupAndSync(group)
		close()
	}

	// leave hands off to the existing leave-group flow and closes the pop-up
	leave(controller: ViewController, group: Group | EncryptedGroup, close: () => void) {
		close()
		controller.leaveGroup(group.id)
	}
}
