import m, { type Vnode } from "mithril"

import { Controller } from "../service/controller"
import { groupIsEncrypted } from "../model/group"
import { synthClick } from "./utils"

type GroupWelcomeVnode = Vnode<GroupWelcomeArgs, GroupWelcomeState>

interface GroupWelcomeArgs {
	controller: Controller
}

interface GroupWelcomeState {
}

export class GroupWelcome {

	oninit(vnode: GroupWelcomeVnode) {
		return undefined
	}

	view(vnode: GroupWelcomeVnode) {

		// List the settings
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const contactStreams = controller.groupContactStream()
		const isEncrypted = groupIsEncrypted(group)

		const contacts = contactStreams
			.map(contactStream => contactStream())
			.filter(contact => contact !== undefined)
			.filter(contact => contact.id != controller.actorId())

		const creator = contacts.find(contact => contact.id == group.createdById)

		return (
			<div id="conversation-details">
				<div id="conversation-messages">

					<div class="flex-column flex-align-center max-width-640 padding-xl">

						<img src={creator?.icon} class="width-96 circle margin-none" alt="" />
						<div class="text-xl margin-none">{creator?.name}</div>
						<div class="text-gray link margin-bottom" onclick={() => this.clickUsername(vnode)} onkeyup={synthClick} role="button" tabindex="0">{creator?.username} <i class="margin-left-xs bi bi-arrow-up-right-square"></i></div>
						<div class="text-lg">

							{isEncrypted ?
								<div>is inviting you to an <i class="margin-left-xs bi bi-lock-fill"></i> <b>encrypted conversation</b></div>
								:
								<div>is inviting you to a <i class="margin-left-xs bi bi-card-text"></i> <b>plaintext conversation</b>.</div>
							}

						</div>

						{isEncrypted ?
							<div class="text-gray">(Encrypted converations cannot be read by anyone outside of the group)</div>
							:
							<div class="text-gray">(Plaintext conversations may be visible by others on the Internet)</div>
						}

						<div class="margin-top-xl card padding width-100% max-width-480">

							<div class="maargin-bottom">"The text of the first message will go here..."</div>

							<div class="margin-top-xl flex-row flex-align-center">
								<button class="primary" onclick={() => this.clickAccept(vnode)}>Accept</button>
								<button class="text-red" onclick={() => this.clickIgnore(vnode)}>Ignore</button>
								<button class="text-red" onclick={() => this.clickBlock(vnode)}>Block</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		)
	}

	/*
<div class="margin-vertical-xl">
{contacts.map(contact => (
	<div key={contact.id} class="flex-row flex-align-center margin-bottom">
		<img src={contact.icon} class="width-32 circle margin-right" alt="" />
		<div class="flex-row flex-align-center">
			<div class="bold">{contact.name}</div>
			<div class="text-sm text-light-gray margin-left">{contact.username}</div>
		</div>
	</div>
))}
</div>
*/


	clickUsername(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.host_actor(group.createdById)
	}

	clickAccept(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.joinGroup(group)
	}

	clickIgnore(vnode: GroupWelcomeVnode) {
		if (!confirm("Ignore this request?\n\nThis will remove the conversation from your list, but the requester may still be able to message you again in the future.")) {
			return
		}

		const controller = vnode.attrs.controller
		const group = controller.groupStream()

		controller.leaveGroup(group.id)
	}

	clickBlock(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.host_block(group.createdById)
	}
}
