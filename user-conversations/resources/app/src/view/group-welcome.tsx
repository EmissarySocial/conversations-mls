import m, { type Vnode } from "mithril"

import { ViewController } from "./controller"
import { groupIsEncrypted } from "../model/group"
import { synthClick } from "./utils"

type GroupWelcomeVnode = Vnode<GroupWelcomeArgs, GroupWelcomeState>

interface GroupWelcomeArgs {
	controller: ViewController
}

interface GroupWelcomeState {
	firstMessage: string
}

export class GroupWelcome {

	// oninit loads the first message from the database when the component is first created
	oninit(vnode: GroupWelcomeVnode) {
		vnode.state.firstMessage = ""
		const group = vnode.attrs.controller.groupStream()
		vnode.attrs.controller.getFirstMessageInGroup(group.id).then(content => {
			vnode.state.firstMessage = content
			m.redraw()
		})
	}

	// view renders the welcome screen shown when the user receives a new group invitation
	view(vnode: GroupWelcomeVnode) {

		// Collect data from the controller
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const contactStreams = controller.groupContactStream()
		const isEncrypted = groupIsEncrypted(group)

		// Resolve contact details for all group members except the current user
		const contacts = contactStreams
			.map(contactStream => contactStream())
			.filter(contact => contact !== undefined)
			.filter(contact => contact.id != controller.actorId())

		// Find the contact who created this group (i.e. the person inviting us)
		const creator = contacts.find(contact => contact.id == group.createdById)

		return (
			<div id="conversation-details">
				<div id="conversation-messages">

					<div class="flex-column flex-align-center max-width-640 padding-xl">

						{/* Creator identity */}
						<img src={creator?.icon} class="width-96 circle margin-none" alt="" />
						<div class="text-xl margin-none">{creator?.name}</div>
						<div class="text-gray link margin-bottom" onclick={() => this.clickUsername(vnode)} onkeyup={synthClick} role="button" tabindex="0">{creator?.username} <i class="margin-left-xs bi bi-arrow-up-right-square"></i></div>

						{/* Invitation description */}
						<div class="text-lg">

							{isEncrypted ?
								<div>is inviting you to an <i class="margin-left-xs bi bi-lock-fill"></i> <b>encrypted conversation</b></div>
								:
								<div>is inviting you to a <i class="margin-left-xs bi bi-card-text"></i> <b>plaintext conversation</b>.</div>
							}

						</div>

						{/* Privacy notice */}
						{isEncrypted ?
							<div class="text-gray">(Encrypted converations cannot be read by anyone outside of the group)</div>
							:
							<div class="text-gray">(Plaintext conversations may be visible by others on the Internet)</div>
						}

						{/* First message preview and action buttons */}
						<div class="margin-top-xl card padding width-100% max-width-480">

							<div class="margin-bottom"><i>{creator?.name}</i> says... {this.firstMessagePreview(vnode.state.firstMessage)}</div>

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

	// firstMessagePreview truncates the first message to 100 characters for display
	firstMessagePreview(content: string): string {

		// Guarantee that the content exists
		if (!content) {
			return ""
		}

		// Truncate the content if necessary
		if (content.length > 100) {
			return content.slice(0, 100) + "…"
		}

		// Otherwise, display the whole thing
		return content
	}

	// clickUsername opens the creator's profile page
	clickUsername(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.host_actor(group.createdById)
	}

	// clickAccept joins the group and transitions it out of the WELCOME state
	clickAccept(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.joinGroup(group)
	}

	// clickIgnore removes the group invitation without blocking the sender
	clickIgnore(vnode: GroupWelcomeVnode) {
		if (!confirm("Ignore this request?\n\nThis will remove the conversation from your list, but the requester may still be able to message you again in the future.")) {
			return
		}

		const controller = vnode.attrs.controller
		const group = controller.groupStream()

		controller.leaveGroup(group.id)
	}

	// clickBlock blocks the creator and removes the group invitation
	clickBlock(vnode: GroupWelcomeVnode) {
		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		controller.host_block(group.createdById)
	}
}
