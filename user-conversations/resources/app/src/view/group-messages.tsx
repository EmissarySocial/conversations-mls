import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { NewContact, type Contact } from "../model/contact"
import { Controller } from "../service/controller"
import { WidgetMessageCreate } from "./widget-message-create"

type GroupMessagesVnode = Vnode<GroupMessagesAttrs, GroupMessagesState>

type GroupMessagesAttrs = {
	controller: Controller
}

type GroupMessagesState = {}

export class GroupMessages {
	oninit(vnode: GroupMessagesVnode) {
	}

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: GroupMessagesVnode) {
		//
		// List the messages in the selected group
		const controller = vnode.attrs.controller

		// Display messages
		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" aria-selected="true">{controller.groupName()}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_members()}>People ({controller.group.members.length})</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_leave()}>Leave</div>
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
										<div>{message.plaintext}</div>
										<div class="text-xs text-light-gray">{new Date(message.createDate).toLocaleString()}</div>
										<div class="pos-absolute-top-right text-sm">
											<i class="bi bi-pencil-square margin-right hover-show clickable"
												onclick={() => controller.modal_editMessage(message.id)}></i>
											<i class="bi bi-trash margin-right hover-show clickable"
												onclick={() => { if (confirm("Are you sure you want to delete this message?")) { vnode.attrs.controller.deleteMessage(message.id) } }}></i>
											{this.likes(vnode, message)}
										</div>
									</div>
								)
							}
							return (
								<div class="message pos-relative hover-trigger flex-row">
									<div class="width-32">
										<img src={contact.icon} class="circle width-32" />
									</div>
									<div class="flex-grow">
										<div class="flex-grow bold">{contact.name}</div>
										<div>{message.plaintext}</div>
										<div class="text-xs text-light-gray">
											{
												(message.history.length > 0)
													? <span class="clickable" onclick={() => controller.modal_messageHistory(message.id)}><span class="text-underline">Edited</span> {new Date(message.updateDate).toLocaleString()}</span>
													: new Date(message.updateDate).toLocaleString()
											}
										</div>
										<div class="pos-absolute-top-right text-sm">
											{this.likes(vnode, message)}
										</div>
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

	likes(vnode: GroupMessagesVnode, message: Message): JSX.Element {

		if (message.likes == undefined) {
			message.likes = []
		}

		if (message.likes.length == 0) {
			return (
				<span class="hover-show clickable margin-right-xs" onclick={() => vnode.attrs.controller.likeMessage(message.id)}>
					<i class="bi bi-heart"></i>
				</span>
			)
		}

		if (message.likes.includes(vnode.attrs.controller.actorId())) {
			return (
				<span class="clickable" onclick={() => vnode.attrs.controller.undoLikeMessage(message.id)}>
					<i class="bi bi-heart-fill text-red margin-right-xs" hint={vnode.attrs.controller.actorId()}></i>
					{(message.likes.length) > 1 ? message.likes.length : ""}
				</span>
			)
		}

		return (
			<span class="clickable" onclick={() => vnode.attrs.controller.likeMessage(message.id)}>
				<i class="bi bi-heart-fill margin-right-xs" hint={vnode.attrs.controller.actorId()}></i>
				{(message.likes.length) > 1 ? message.likes.length : ""}
			</span>
		)
	}
}
