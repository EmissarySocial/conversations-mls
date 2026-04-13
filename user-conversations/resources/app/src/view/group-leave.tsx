import m from "mithril"
import { Controller } from "../service/controller"
import { type Group } from "../model/group"
import { type Vnode, type VnodeDOM, type Component } from "mithril"


type GroupLeaveVnode = Vnode<GroupLeaveArgs, GroupLeaveState>

interface GroupLeaveArgs {
	controller: Controller
}

interface GroupLeaveState {
	group: Group
}

export class GroupLeave {

	oninit(vnode: GroupLeaveVnode) {
		vnode.state.group = vnode.attrs.controller.groupStream()
	}

	view(vnode: GroupLeaveVnode) {

		// List the settings
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const groupName = group.name || group.defaultName || "Messages"

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_messages()}>{groupName}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_members()}>People ({controller.groupMemberStream().length})</div>
						<div role="tab" aria-selected="true">Leave</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="card max-width-640 padding">
						<div class="bold margin-bottom-sm">Are you sure you want to leave "{groupName}"?</div>
						<div class="margin-bottom">
							If you leave this group, it will be removed from all of your devices.
							<br />
							Other group members will still have access to the conversation and its history.
						</div>
						<button class="text-red" onclick={() => this.delete(vnode)}>
							Leave Group
						</button>
					</div>
				</div>
			</div>
		)
	}

	async delete(vnode: GroupLeaveVnode) {

		// Confirm the user's intent
		if (!confirm("Are you sure you want to leave this group? This action cannot be undone.")) {
			return
		}

		// Delete the group
		await vnode.attrs.controller.leaveGroup(vnode.state.group.id)

		// Close the modal dialog
		this.close(vnode)
	}

	close(vnode: GroupLeaveVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
