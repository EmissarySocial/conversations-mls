import m, { type VnodeDOM } from "mithril"
import type Stream from "mithril/stream"

import dayjs from "dayjs"

import { ViewController as Controller } from "./controller"
import { WidgetMessageCreate } from "./widget-message-create"
import { ViewMessage } from "./message"
import relativeTime from "dayjs/plugin/relativeTime"
import { type Contact } from "../model/contact"
import { groupIsEncrypted, type Group, type EncryptedGroup, type GroupState } from "../model/group"
import { synthClick } from "./utils"

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

	// viewStateButton renders one of the group-status buttons (Important / Active /
	// Archived). The button matching the group's current state appears selected;
	// clicking an unselected button changes the group's state. The label is used as
	// the accessible name for the icon-only button.
	viewStateButton(controller: Controller, group: Group | EncryptedGroup, state: GroupState, icon: string, label: string): m.Children {

		const isSelected = (group.stateId == state)
		const cssClass = "text-sm" + (isSelected ? " pressed" : "")
		const iconClass = "bi bi-" + icon + (isSelected ? "-fill" : "")

		return (
			<button type="button" class={cssClass} title={label} aria-label={label} aria-pressed={isSelected ? "true" : "false"} onclick={() => controller.setSelectedGroupState(state)}>
				<i class={iconClass}></i>
			</button>
		)
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
		let lastSender = ""

		const classNames = groupIsEncrypted(group) ? "encrypted" : ""

		// Display messages
		return (
			<div id="conversation-details">
				<div id="conversation-header" class="flex-row flex-align-center">
					<div role="tablist" class="margin-none padding-none underlined flex-grow">
						<div role="tab" aria-selected="true">{group.name || group.defaultName || "Messages"}</div>
						<div role="tab" tabIndex="0" onclick={() => vnode.attrs.controller.page_group_notes()} onkeypress={synthClick}>Notes</div>
						<div role="tab" tabIndex="0" onclick={() => controller.page_group_members()} onkeypress={synthClick}>People ({group.members.length})</div>
					</div>
					<div class="button-group">
						{this.viewStateButton(controller, group, "IMPORTANT", "star", "Important")}
						{this.viewStateButton(controller, group, "ACTIVE", "chat", "Active")}
						{this.viewStateButton(controller, group, "ARCHIVED", "archive", "Archived")}
					</div>
				</div>
				<div id="conversation-messages" class={classNames}>
					<div class="flex-grow padding-sm padding-bottom-lg">
						{controller.messages.map(message => {

							let sender: Stream<Contact> | undefined

							if (message.sender != lastSender) {
								sender = vnode.state.contacts.find(contact => contact().id == message.sender)
								lastSender = message.sender
							}

							return <ViewMessage key={message.id} controller={controller} message={message} sender={sender} showDate="" />
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
