import m from "mithril"
import { type VnodeDOM } from "mithril"
import { Controller } from "../service/controller"
import { WidgetMessageCreate } from "./widget-message-create"
import { ViewMessage } from "./message"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { type Contact } from "../model/contact"
import type Stream from "mithril/stream"

dayjs.extend(relativeTime)

type GroupMessagesVnode = VnodeDOM<GroupMessagesAttrs, GroupMessagesState>

type GroupMessagesAttrs = {
	controller: Controller
}

type GroupMessagesState = {
	previousMessageCount: number
	contacts: Stream<Contact>[]
}

export class GroupMessages {

	oninit(vnode: GroupMessagesVnode) {
		vnode.state.previousMessageCount = 0
		vnode.state.contacts = vnode.attrs.controller.groupContactStream()
	}

	oncreate(vnode: GroupMessagesVnode) {
		this.scrollToBottom(vnode)
	}

	onupdate(vnode: GroupMessagesVnode) {
		const currentMessageCount = vnode.attrs.controller.messages.length;
		if (currentMessageCount !== vnode.state.previousMessageCount) {
			this.scrollToBottom(vnode)
		}
	}

	scrollToBottom(vnode: GroupMessagesVnode) {
		vnode.state.previousMessageCount = vnode.attrs.controller.messages.length;

		const domElement = document.getElementById("conversation-messages")!
		domElement.scrollTop = domElement.scrollHeight
	}

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: GroupMessagesVnode) {

		// List the messages in the selected group
		const controller = vnode.attrs.controller
		const group = controller.groupStream()

		// Grouping values
		var lastSender = ""

		// Display messages
		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" aria-selected="true">{group.name || group.defaultName || "Messages"}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" onclick={() => controller.page_group_members()}>People ({group.members.length})</div>
					</div>
				</div>
				<div id="conversation-messages">
					<div class="flex-grow padding-sm padding-bottom-lg">
						{controller.messages.map(message => {

							var sender: Stream<Contact> | undefined

							if (message.sender != lastSender) {
								sender = vnode.state.contacts.find(contact => contact().id == message.sender)
								lastSender = message.sender
							}

							return <ViewMessage controller={controller} message={message} sender={sender} showDate="" />
						})}
					</div>
				</div>
				<div id="conversation-create-widget">
					<div class="padding-sm">
						<WidgetMessageCreate controller={vnode.attrs.controller} inReplyTo={vnode.attrs.controller.inReplyTo} />
					</div>
				</div>
			</div>
		)
	}
}
