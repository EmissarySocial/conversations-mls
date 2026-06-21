import m, { type Vnode } from "mithril"
import { type Contact } from "../model/contact"

import { ViewController } from "./controller"
import { groupColor, type Group } from "../model/group"
import { synthClick } from "./utils"

type GroupMembersVnode = Vnode<GroupMembersArgs, GroupMembersState>

interface GroupMembersArgs {
	controller: ViewController
}

interface GroupMembersState {
}

export class GroupMembers {

	oninit(vnode: GroupMembersVnode) {
		return undefined
	}

	view(vnode: GroupMembersVnode) {

		// List the settings
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const contactStreams = controller.groupContactStream()

		const contacts = contactStreams
			.map(contactStream => contactStream())
			.filter(contact => contact !== undefined)
			.filter(contact => contact.id != controller.actorId())

		return (
			<div id="conversation-details" style={{ "--focus-color": groupColor(group) }}>
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" tabIndex="0" onclick={() => vnode.attrs.controller.page_group_messages()} onkeypress={synthClick}>{group.name || group.defaultName || "Messages"}</div>
						<div role="tab" tabIndex="0" onclick={() => vnode.attrs.controller.page_group_notes()} onkeypress={synthClick}>Notes</div>
						<div role="tab" aria-selected="true">People ({contactStreams.length})</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<div class="table">
						{(group.stateId === "CLOSED") ? null :
							<div role="link" tabIndex="0" class="flex-row" onclick={() => vnode.attrs.controller.modal_addGroupMember()} onkeypress={synthClick}>
								<div>
									<span class="circle width-48 flex-center text-white text-xl margin-none" style="background-color:var(--focus-color)"><i class="bi bi-plus"></i></span>
								</div>
								<div class="flex-grow padding-left-sm">
									<div class="bold">Add People</div>
									<div class="text-gray">Invite one or more people to this conversation</div>
								</div>
							</div>
						}

						{contacts.map(contact => {

							return (

								<div key={contact.id} class="flex-row" role="button">
									<div role="link" tabIndex="0" onclick={() => controller.host_actor(contact.id)} onkeypress={synthClick}>
										<img src={contact.icon} class="circle width-48" alt="" />
									</div>
									<div class="flex-grow padding-left-sm" role="link" tabIndex="0" onclick={() => controller.host_actor(contact.id)} onkeypress={synthClick}>
										<div class="bold">{contact.name}</div>
										<div class="text-gray">{contact.username}</div>
									</div>
									<div class="align-right">
										{this.drawActionButton(vnode, group, contact)}
									</div>
								</div>
							)
						})}

						<div role="link" tabIndex="0" class="flex-row" onclick={() => this.leaveGroup(vnode)} onkeypress={synthClick}>
							<div>
								<span class="circle width-48 flex-center text-white text-xl margin-none" style="background-color:var(--red60)"><i class="bi bi-x"></i></span>
							</div>
							<div class="flex-grow padding-left-sm">
								<div class="bold">Leave Group</div>
								<div class="text-gray">Leave this conversation and remove it from all your devices.</div>
							</div>
						</div>

					</div>
				</div>
			</div>
		)
	}

	drawActionButton(vnode: GroupMembersVnode, group: Group, contact: Contact): JSX.Element {

		if (group.stateId == "CLOSED") {
			return <button disabled>Remote</button>
		}

		return (
			<button class="text-sm" tabIndex="0" onclick={() => this.removeGroupMember(vnode, contact.id)} >
				Remove
			</button>
		)
	}

	async leaveGroup(vnode: GroupMembersVnode) {

		if (!confirm("If you leave this group, message history will be removed from all of your devices. Are you sure you want to leave?")) {
			return
		}

		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		await controller.leaveGroup(group.id)
		controller.page_index()
	}

	async removeGroupMember(vnode: GroupMembersVnode, contactId: string) {

		if (!confirm("Are you sure you want to remove this member?")) {
			return
		}

		const controller = vnode.attrs.controller
		await controller.removeGroupMember(contactId)
	}

	close(vnode: GroupMembersVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
