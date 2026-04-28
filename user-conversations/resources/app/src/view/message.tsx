import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { Controller } from "../service/controller"
import { type Contact } from "../model/contact"
import dayjs from "dayjs"
import type Stream from "mithril/stream"
import { formatFileSize, formatHTML, isEmoji } from "./utils"

type ViewMessageVnode = Vnode<ViewMessageAttrs, ViewMessageState>

type ViewMessageAttrs = {
	controller: Controller
	message: Message
	showDate: string
	sender?: Stream<Contact>
}

type ViewMessageState = {
}

export class ViewMessage {

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: ViewMessageVnode) {

		const controller = vnode.attrs.controller
		const message = vnode.attrs.message
		var sender: Contact | undefined

		if (vnode.attrs.sender != undefined) {
			sender = vnode.attrs.sender()
		}

		const senderName = sender?.name || message.sender

		switch (message.type) {

			case "SENT": {

				if (isEmoji(message.content)) {
					return (
						<div class="message sent">
							<div>
								<div class="align-center margin-none padding-top-lg padding-bottom-sm" style="font-size:48px;">{message.content}</div>
								<div class="message-options flex-row flex-align-center">
									<div class="text-gray">
										<button tabIndex="0" onclick={() => controller.modal_editMessage(message.id)}><i class="bi bi-pencil-square"></i> Edit</button>
										{this.drawAcknowledgements(vnode)}
										{this.drawPostTime(vnode)}
									</div>
								</div>
							</div>
						</div>
					)
				}

				return (
					<div class="message sent">
						<div class="bubble">
							{this.drawContent(message)}
							{this.drawReactions(vnode)}
						</div>
					</div>
				)
			}

			case "RECEIVED": {

				if (isEmoji(message.content)) {
					return (
						<div class="message received">

							<div class="sender-icon"></div>

							<div class="flex-grow">
								{(sender != undefined) && (
									<div class="sender">{sender.name || "..."}</div>
								)}
								<div>
									<div class="padding-top-lg padding-bottom-sm" style="font-size:48px;">{message.content}</div>
									<div class="message-options flex-row flex-align-center">
										<div class="text-gray">
											{this.drawPostTime(vnode)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)
				}

				return (
					<div class="message received">

						<div class="sender-icon">
							{(sender != undefined) && <img src={sender.icon} class="circle width-48" />}
						</div>

						<div class="flex-grow">
							{(sender != undefined) && (
								<div class="sender">{sender.name || "..."}</div>
							)}
							<div class="bubble">
								{this.drawContent(message)}
								{this.drawReactions(vnode)}
							</div>
						</div>
					</div>
				)
			}

			case "ADD-ACTOR": {

				const contact = vnode.attrs.controller.getContactStream(message.sender)()

				return (
					<div class="message status">
						<div>
							<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)}>
								<img src={contact.icon} class="circle margin-right-xs" style="height:1em;" />
								{contact.name}
							</span> {" "}
							JOINED the group at {dayjs(message.createDate).format("h:mm A")}
						</div>
					</div>
				)
			}

			case "REMOVE-ACTOR": {

				const contact = vnode.attrs.controller.getContactStream(message.sender)()

				return (
					<div class="message status">
						<div>
							<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)}>
								<img src={contact.icon} class="circle margin-right-xs" style="height:1em;" />
								{contact.name}
							</span> {" "}
							left the group at {dayjs(message.createDate).format("h:mm A")}
						</div>
					</div>
				)
			}

			case "ADD-DEVICE": {
				const contact = vnode.attrs.controller.getContactStream(message.sender)

				return (
					<div class="message status">
						<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)}>{senderName}</span> {" "}
						ADDED a new device
					</div>
				)
			}

			case "REMOVE-DEVICE":
		}

		throw new Error(`Unknown message type: ${message.type}`)
	}

	drawContent(message: Message): JSX.Element {

		return <>
			{message.attachments.map(attachment => (
				attachment.startsWith("data:image") ? (
					<img src={attachment} class="width-100% rounded" />
				) : (
					<a href={attachment} class="attachment" target="_blank" rel="noopener noreferrer">
						<i class="bi bi-file-earmark-arrow-down"></i> Download File ({formatFileSize(attachment.length)})
					</a>
				)
			))}
			<div class="padding-xs">{m.trust(formatHTML(message.content))}</div>
		</>

	}

	drawReactions(vnode: ViewMessageVnode): (JSX.Element | undefined) {

		const controller = vnode.attrs.controller
		const message = vnode.attrs.message
		const reactions = Object.entries(message.reactions)
		const isSentByMe = (message.type == "SENT")

		return (
			<div class="message-options flex-row flex-align-center">
				{(reactions.length > 0) &&
					<div>
						{reactions.map(([content, actors]) => {
							const hasReacted = message.reactions[content]?.includes(controller.actorId())
							const reactionCount = (actors.length > 1) ? actors.length : ""

							// READ ONLY: I cannot react to messages sent by myself.
							if (isSentByMe) {
								return <button>{content} {reactionCount}</button>
							}

							// Show my reaction as selected and allow me to undo
							if (hasReacted) {
								return <button class="selected" onclick={() => controller.undoReaction(message.id)}>{content} {reactionCount}</button>
							}

							// Show unselected reactions that I can also join
							return <button tabIndex="0" onclick={() => controller.reactToMessage(message.id, content)}>{content} {reactionCount}</button>
						})}
					</div>
				}
				<div class="text-gray flex-grow">
					{isSentByMe ||
						<button tabIndex="0" onclick={() => controller.modal_startReaction(message)}><i class="bi bi-emoji-smile"></i> Like</button>
					}
					<button tabIndex="0" onclick={() => controller.startReply(message)}><i class="bi bi-reply"></i> Reply</button>

					{isSentByMe &&
						<button tabIndex="0" onclick={() => controller.modal_editMessage(message.id)}><i class="bi bi-pencil-square"></i> Edit</button>
					}
				</div>
				<div class="text-gray">
					{this.drawAcknowledgements(vnode)}
					{this.drawPostTime(vnode)}
				</div>
			</div>
		)
	}

	drawAcknowledgements(vnode: ViewMessageVnode): JSX.Element | null {

		if (vnode.attrs.message.received.length == 0) {
			return null
		}

		if (vnode.attrs.message.received.length < 5) {
			return (
				<span>
					{vnode.attrs.message.received.map(actorId => <i class="bi bi-check-circle" style="margin-right:2px;" title={`Received by ${actorId}`}></i>)}
					<span class="margin-horizontal-xs">&middot;</span>
				</span>
			)
		}

		return (
			<span>
				<i class="bi bi-check-circle" style="margin-right:2px;"></i> {vnode.attrs.message.received.length}
				<span class="margin-horizontal-xs">&middot;</span>
			</span>
		)
	}

	drawPostTime(vnode: ViewMessageVnode): JSX.Element {

		const message = vnode.attrs.message

		if (message.history.length == 0) {
			return <span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
		}

		return (
			<span class="clickable"
				onclick={() => vnode.attrs.controller.modal_messageHistory(message.id)}>
				<span class="nowrap text-underline margin-right-xs"><i class="bi bi-clock-history"></i> Edited</span>
				<span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
			</span>
		)
	}

	drawPostDate(vnode: ViewMessageVnode): JSX.Element {

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

	sendReaction(vnode: ViewMessageVnode, content: string) {
		vnode.attrs.controller.reactToMessage(vnode.attrs.message.id, content)
	}

	copy(vnode: ViewMessageVnode) {
		navigator.clipboard.writeText(vnode.attrs.message.content)
		alert("Message copied to clipboard")
	}

	edit(vnode: ViewMessageVnode) {
		vnode.attrs.controller.modal_editMessage(vnode.attrs.message.id)
	}
}
