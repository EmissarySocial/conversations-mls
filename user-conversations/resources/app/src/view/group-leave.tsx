import m from "mithril"
import { Controller } from "../service/controller"
import { type Group } from "../model/group"
import { type Vnode, type VnodeDOM, type Component } from "mithril"


type GroupLeaveVnode = Vnode<GroupLeaveArgs, GroupLeaveState>

interface GroupLeaveArgs {
	controller: Controller
	group: Group
}

interface GroupLeaveState {
	name: string
	tags: string
}

export class GroupLeave {
	//

	oninit(vnode: GroupLeaveVnode) {
		vnode.state.name = vnode.attrs.group.name

		if (vnode.attrs.group.tags == undefined) {
			vnode.attrs.group.tags = []
		}
		vnode.state.tags = vnode.attrs.group.tags.map((tag) => "#" + tag).join(" ")
	}

	view(vnode: GroupLeaveVnode) {

		// List the settings
		const controller = vnode.attrs.controller

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_messages()}>{controller.groupName()}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_members()}>People ({controller.group.members.length})</div>
						<div role="tab" aria-selected="true">Leave</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="card max-width-640 padding">
						<div class="bold margin-bottom-sm">Are you sure you want to leave "{controller.groupName()}"?</div>
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

	setName(vnode: GroupLeaveVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.name = target.value
	}

	setTags(vnode: GroupLeaveVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.tags = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: GroupLeaveVnode) {
		//
		// Halt the form submission to prevent a page reload
		event.preventDefault()
		event.stopPropagation()

		// Copy values from the form into the Group object
		vnode.attrs.group.name = vnode.state.name

		// Clean up tags input
		vnode.state.tags = vnode.state.tags.replaceAll("#", "")
		vnode.state.tags = vnode.state.tags.trim()

		if (vnode.state.tags.trim() == "") {
			vnode.attrs.group.tags = []
		} else {
			vnode.attrs.group.tags = vnode.state.tags.split(/\s+/).map((tag) => tag.trim())
		}

		// Save the Group to the database
		await vnode.attrs.controller.saveGroup(vnode.attrs.group)

		// Success. Close the modal dialog and redraw the screen
		return this.close(vnode)
	}

	async delete(vnode: GroupLeaveVnode) {
		//
		// Confirm the user's intent
		if (!confirm("Are you sure you want to leave this group? This action cannot be undone.")) {
			return
		}

		// Delete the group
		await vnode.attrs.controller.leaveGroup(vnode.attrs.group.id)

		// Close the modal dialog
		this.close(vnode)
	}

	close(vnode: GroupLeaveVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
