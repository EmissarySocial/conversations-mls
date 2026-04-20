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
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="table">
						{(group.stateId !== "CLOSED") &&
							<div role="link" class="flex-row" onclick={() => vnode.attrs.controller.modal_addGroupMember()}>
								<div>
									<span class="circle width-48 flex-center text-white text-xl margin-none" style="background-color:var(--blue60)"><i class="bi bi-plus"></i></span>
								</div>
								<div class="flex-grow padding-left-sm">
									<div class="bold">Add People</div>
									<div class="text-gray">Invite one or more people to this group</div>
								</div>
							</div>
						}

						{contactStreams.map(contactStream => {
							const contact = contactStream()

							if (contact.id == controller.actorId()) {
								return null
							}

							return (

								<div class="flex-row" role="button">
									<div onclick={() => controller.host_actor(contact.id)}>
										<img src={contact.icon} class="circle width-48" />
									</div>
									<div class="flex-grow padding-left-sm" onclick={() => controller.host_actor(contact.id)}>
										<div class="bold">{contact.name}</div>
										<div class="text-gray">{contact.username}</div>
									</div>
									<div class="align-right">
										{
											(contact.id == controller.actorId())
												?
												<button class="text-sm text-red" tabIndex="0" onclick={() => this.leaveGroup(vnode)} >
													Leave Group
												</button>
												:
												<button class="text-sm" tabIndex="0" onclick={() => this.removeGroupMember(vnode, contact.id)} >
													Remove
												</button>
										}
									</div>
								</div>
							)
						})}

						<div role="link" class="flex-row" onclick={() => this.leaveGroup(vnode)}>
							<div>
								<span class="circle width-48 flex-center text-white text-xl margin-none" style="background-color:var(--red60)"><i class="bi bi-x"></i></span>
							</div>
							<div class="flex-grow padding-left-sm">
								<div class="bold">Leave Group</div>
								<div class="text-gray">Leave this group and remove it from all your devices.</div>
							</div>
						</div>

					</div>
				</div>
			</div>
		)
	}

	async leaveGroup(vnode: GroupMembersVnode) {
		console.log("confirm: leave group")

		if (!confirm("If you leave this group, message history will be removed from all of your devices. Are you sure you want to leave?")) {
			console.log("NOT leaving group")
			return
		}

		console.log("leaving group")
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		await controller.leaveGroup(group.id)
		controller.page_index()
	}

	async removeGroupMember(vnode: GroupMembersVnode, contactId: string) {

		if (!confirm("Are you sure you want to remove this member?")) {
			return
		}

		await vnode.attrs.controller.removeGroupMember(contactId)
	}

	close(vnode: GroupMembersVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
