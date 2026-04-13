import m from "mithril"
import { Controller } from "../service/controller"
import { type Group } from "../model/group"
import { type Vnode, type VnodeDOM, type Component } from "mithril"

type GroupMembersVnode = Vnode<GroupMembersArgs, GroupMembersState>

interface GroupMembersArgs {
	controller: Controller
}

interface GroupMembersState {
}

export class GroupMembers {

	oninit(vnode: GroupMembersVnode) {
	}

	view(vnode: GroupMembersVnode) {

		// List the settings
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const contactStreams = controller.groupContactStream()

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_messages()}>{group.name || group.defaultName || "Messages"}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" aria-selected="true">People ({contactStreams.length})</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_leave()}>Leave</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="table">

						<div role="link" class="flex-row" onclick={() => vnode.attrs.controller.modal_addGroupMember()}>
							<div>
								<span class="circle width-48 flex-center bg-gray text-white text-lg" style="background-color:var(--blue60)">+</span>
							</div>
							<div class="flex-grow padding-left-sm">
								<div class="bold">Add People</div>
								<div class="text-gray">Invite one or more people to this group</div>
							</div>
						</div>

						{contactStreams.map(contactStream => {
							const contact = contactStream()
							return (

								<div class="flex-row">
									<div>
										<img src={contact.icon} class="circle width-48" />
									</div>
									<div class="flex-grow padding-left-sm">
										<div class="bold">{contact.name}</div>
										<div class="text-gray">{contact.username}</div>
									</div>
									<div class="align-right">
										{
											(contact.id == controller.actorId()) ||
											<button class="text-sm" tabIndex="0" onclick={() => this.removeGroupMember(vnode, contact.id)} >
												Remove
											</button>
										}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</div>
		)
	}

	removeGroupMember(vnode: GroupMembersVnode, contactId: string) {
		if (confirm("Are you sure you want to remove this member?")) {
			vnode.attrs.controller.removeGroupMember(contactId)
			m.redraw()
		}
	}

	close(vnode: GroupMembersVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
