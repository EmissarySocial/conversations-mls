import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { NewContact, type Contact } from "../model/contact"
import { Controller } from "../service/controller"
import { WidgetMessageCreate } from "./widget-message-create"
import { MessageOptions } from "./message-options"
import dayjs from "dayjs"
import type Stream from "mithril/stream"

type ViewMessageVnode = Vnode<ViewMessageAttrs, ViewMessageState>

type ViewMessageAttrs = {
	controller: Controller
	message: Message
	showOptions: boolean
	showSender: boolean
	showDate: string
}

type ViewMessageState = {
	contactStream: Stream<Map<string, Contact>>
}

export class ViewMessage {

	oninit(vnode: ViewMessageVnode) {

		// Create a new stream that converts the array of contacts into a map of contacts
		vnode.state.contactStream = vnode.attrs.controller.groupContactStream.map(contactStreams => {
			const result = new Map<string, Contact>()
			contactStreams.forEach(contactStream => {
				const contact = contactStream()
				result.set(contact.id, contact)
			})
			return result
		})
	}

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: ViewMessageVnode) {

		// List the messages in the selected group
		const controller = vnode.attrs.controller
		const message = vnode.attrs.message

		switch (message.type) {

			case "SENT":

				return (
					<div class="message sent">
						{this.drawDate(vnode)}
						<div class="bubble hover-trigger pos-relative" onclick={() => vnode.attrs.showOptions = true}>
							<div>
								{this.drawAcknowledgements(vnode)}
								<div class="flex-grow">{message.content}</div>
							</div>
							<MessageOptions controller={controller} message={message} open={vnode.attrs.showOptions} />

						</div>
					</div>
				)

			case "RECEIVED":

				return (
					<div class="message received">
						{this.drawDate(vnode)}
						{this.drawSender(vnode)}
						<div class="bubble hover-trigger pos-relative" onclick={() => vnode.attrs.showOptions = true}>
							<div class="flex-row flex-align-start width-100% max-width-100%">
								<div class="flex-grow">{message.content}</div>
								<div class="flex-row flex-align-center text-xs text-gray">
									{(message.history.length > 0) ?
										<span class="clickable"
											onclick={() => controller.modal_messageHistory(message.id)}>
											<span class="nowrap text-underline margin-right-xs">Edited</span>
											<span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
										</span>
										:
										<span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
									}
								</div>
							</div>
							<MessageOptions controller={controller} message={message} open={vnode.attrs.showOptions} />

						</div>
					</div>
				)

			case "ADD-ACTOR":
				return <div>Add Actor</div>

			case "REMOVE-ACTOR":
				return <div>Remove Actor</div>

			case "ADD-DEVICE":
				return <div>Add Device</div>

			case "REMOVE-DEVICE":
				return <div>Remove Device</div>
		}

		throw new Error(`Unknown message type: ${message.type}`)
	}

	drawAcknowledgements(vnode: ViewMessageVnode): JSX.Element | null {

		if (vnode.attrs.message.received.length == 0) {
			return null
		}

		if (vnode.attrs.message.received.length < 4) {
			return (
				<div class="float-right padding-left-lg padding-bottom-lg text-gray nowrap text-xs">
					{vnode.attrs.message.received.map(actorId => <i class="bi bi-check-circle" style="margin-right:2px;" title={`Received by ${actorId}`}></i>)}
					{dayjs(vnode.attrs.message.updateDate).format("hh:mm A")}
				</div>
			)
		}

		return (
			<div class="float-right padding-left-lg padding-bottom-lg text-gray nowrap text-xs">
				<i class="bi bi-check-circle" style="margin-right:2px;"></i> {vnode.attrs.message.received.length}
				&nbsp;
				{dayjs(vnode.attrs.message.updateDate).format("hh:mm A")}
			</div>
		)
	}

	drawDate(vnode: ViewMessageVnode): JSX.Element {

		const showDate = vnode.attrs.showDate

		if (showDate == "") {
			return <div></div>
		}

		return (
			<div class="margin-top margin-horizontal-sm text-sm text-light-gray">
				{vnode.attrs.showDate}
			</div>
		)
	}

	drawSender(vnode: ViewMessageVnode): JSX.Element {

		// If this is not the beginning of a new group, then don't display anything
		if (!vnode.attrs.showSender) {
			return <div></div>
		}

		const contacts = vnode.state.contactStream()

		// If there are fewer than three people in the group, then we don't need to display the sender's name.
		if (contacts.size < 3) {
			return <div></div>
		}

		// Look up the contact in the group contact list
		const sender = vnode.attrs.message.sender
		const contact = contacts.get(sender) || NewContact(sender)

		return (
			<div class="margin-top margin-left-sm">
				<div>{contact.name}</div>
			</div>
		)
	}
}
