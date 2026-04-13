import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { Controller } from "../service/controller"
import { type Contact } from "../model/contact"
import dayjs from "dayjs"
import type Stream from "mithril/stream"

type ViewMessageVnode = Vnode<ViewMessageAttrs, ViewMessageState>

type ViewMessageAttrs = {
	controller: Controller
	message: Message
	showOptions: boolean
	showDate: string
	sender?: Stream<Contact>
}

type ViewMessageState = {
}

export class ViewMessage {

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: ViewMessageVnode) {

		const message = vnode.attrs.message
		var sender: Contact | undefined

		if (vnode.attrs.sender != undefined) {
			sender = vnode.attrs.sender()
		}

		switch (message.type) {

			case "SENT":

				return (
					<div class="message sent">
						<div class="bubble" onclick={() => vnode.attrs.showOptions = true}>
							{this.drawAcknowledgements(vnode)}
							<div class="padding-xs">{message.content}</div>
							{this.drawReactions(vnode, message)}
						</div>
					</div>
				)

			case "RECEIVED":

				return (
					<div class="message received">

						<div class="sender-icon">
							{(sender != undefined) && <img src={sender.icon} class="circle width-48" />}
						</div>

						<div class="flex-grow">
							{(sender != undefined) && (
								<div class="sender">{sender.name || "..."}</div>
							)}
							<div class="bubble" onclick={() => vnode.attrs.showOptions = true}>
								<div class="padding-xs">{message.content}</div>
								{this.drawReactions(vnode, message)}
							</div>
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

	drawReactions(vnode: ViewMessageVnode, message: Message): (JSX.Element | undefined) {

		const controller = vnode.attrs.controller
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
					{(message.history.length > 0) ?
						<span class="clickable"
							onclick={() => controller.modal_messageHistory(message.id)}>
							<span class="nowrap text-underline margin-right-xs"><i class="bi bi-clock-history"></i> Edited</span>
							<span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
						</span>
						:
						<span class="nowrap">{dayjs(message.updateDate).format("hh:mm A")}</span>
					}
				</div>
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
