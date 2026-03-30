import m from "mithril"
import { Controller } from "../service/controller"
import { type Group } from "../model/group"
import { type Vnode, type VnodeDOM, type Component } from "mithril"

type GroupMembersVnode = Vnode<GroupMembersArgs, GroupMembersState>

interface GroupMembersArgs {
	controller: Controller
	group: Group
}

interface GroupMembersState {
	name: string
	tags: string
}

export class GroupMembers {
	//

	oninit(vnode: GroupMembersVnode) {
	}

	view(vnode: GroupMembersVnode) {
		//
		// List the settings
		const controller = vnode.attrs.controller
		const contactsList = Array.from(controller.contacts.values())

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_messages()}>{controller.groupName()}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" aria-selected="true">People ({controller.group.members.length})</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_leave()}>Leave</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="table">

						<div role="link" class="flex-row" onclick={() => vnode.attrs.controller.modal_addContact()}>
							<div>
								<span class="circle width-48 flex-center bg-gray text-white text-lg" style="background-color:var(--blue60)">+</span>
							</div>
							<div class="flex-grow padding-left-sm">
								<div class="bold">Add People</div>
								<div class="text-gray">Invite one or more people to this group</div>
							</div>
						</div>

						{contactsList.map((contact) => {
							return (

								<div class="flex-row">
									<div>
										<img src={contact.icon} class="circle width-48" />
									</div>
									<div class="flex-grow padding-left-sm">
										<div class="bold">{contact.name}</div>
										<div class="text-gray">{contact.id}</div>
									</div>
									<div class="align-right">
										<button class="text-sm" tabIndex="0" onclick={() => this.removeContact(vnode, contact.id)} >
											Remove
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</div>
		)
	}

	setName(vnode: GroupMembersVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.name = target.value
	}

	setTags(vnode: GroupMembersVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.tags = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: GroupMembersVnode) {
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

	removeContact(vnode: GroupMembersVnode, contactId: string) {
		if (confirm("Are you sure you want to remove this member?")) {
			vnode.attrs.controller.removeContact(contactId)
		}
	}

	close(vnode: GroupMembersVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
