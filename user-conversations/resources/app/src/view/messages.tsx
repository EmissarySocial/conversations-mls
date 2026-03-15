import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { NewContact, type Contact } from "../model/contact"
import { Controller } from "../service/controller"
import { WidgetMessageCreate } from "./widget-message-create"

type MessagesVnode = Vnode<MessagesAttrs, MessagesState>

type MessagesAttrs = {
	controller: Controller
}

type MessagesState = {}

export class Messages {
	oninit(vnode: MessagesVnode) { }

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: MessagesVnode) {
		//
		// List the messages in the selected group
		const controller = vnode.attrs.controller
		const contactsList = Array.from(controller.contacts.values())

		// Display messages
		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div class="flex-row flex-align-center">
						<div class="flex-grow">
							<span class="bold">{controller.group.name}</span>
							&nbsp;
							<div class="text-xs text-gray">
								{contactsList.slice(0, 6).map((contact, index) => (
									<button>{contact.name}</button>
								))}
							</div>
						</div>
						<div>
							<button class="text-sm" onclick={() => vnode.attrs.controller.page_group_settings()}>
								Group Info
							</button>
						</div>
					</div>
				</div>
				<div id="conversation-messages">
					<div class="flex-grow padding-sm padding-bottom-lg">
						{controller.messages.map((message) => {
							const contact = controller.contacts.get(message.sender) || NewContact()
							const isMe = message.sender == controller.actorId()

							if (isMe) {
								return (
									<div class="message me pos-relative hover-trigger">
										<div class="bold">{isMe ? "" : contact.name}</div>
										<div>{message.plaintext}</div>
										<div class="text-xs text-light-gray">{new Date(message.createDate).toLocaleString()}</div>
										<div class="pos-absolute-top-right text-sm">
											{this.likes(vnode, message)}
										</div>
									</div>
								)
							}
							return (
								<div class="message pos-relative hover-trigger">
									<div class="bold flex-grow">{contact.name}</div>
									<div>{message.plaintext}</div>
									<div class="text-xs text-light-gray">{new Date(message.createDate).toLocaleString()}</div>
									<div class="pos-absolute-top-right text-sm">
										{this.likes(vnode, message)}
									</div>
								</div>
							)
						})}
					</div>
				</div>
				<div id="conversation-create-widget">
					<div class="padding-sm">
						<WidgetMessageCreate controller={vnode.attrs.controller} />
					</div>
				</div>
			</div>
		)
	}

	likes(vnode: MessagesVnode, message: Message): JSX.Element {

		if (message.likes == undefined) {
			message.likes = []
		}

		if (message.likes.length == 0) {
			return (
				<span class="hover-show clickable" onclick={() => vnode.attrs.controller.like_message(message.id)}>
					<i class="bi bi-heart"></i>
				</span>
			)
		}

		if (message.likes.includes(vnode.attrs.controller.actorId())) {
			return (
				<span class="clickable" onclick={() => vnode.attrs.controller.undo_like_message(message.id)}>
					<i class="bi bi-heart-fill text-red margin-right-xs" hint={vnode.attrs.controller.actorId()}></i>
					{(message.likes.length) > 1 ? message.likes.length : ""}
				</span>
			)
		}

		return (
			<span class="clickable" onclick={() => vnode.attrs.controller.like_message(message.id)}>
				<i class="bi bi-heart-fill margin-right-xs" hint={vnode.attrs.controller.actorId()}></i>
				{(message.likes.length) > 1 ? message.likes.length : ""}
			</span>
		)
	}
}
