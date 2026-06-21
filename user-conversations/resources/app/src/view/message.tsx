import m, { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { ViewController } from "./controller"
import { type Contact } from "../model/contact"
import dayjs from "dayjs"
import type Stream from "mithril/stream"
import { formatFileSize, isEmoji, synthClick } from "./utils"

type ViewMessageVnode = Vnode<ViewMessageAttrs, ViewMessageState>

type ViewMessageAttrs = {
	controller: ViewController
	key: string
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
		let sender: Contact | undefined

		if (vnode.attrs.sender != undefined) {
			sender = vnode.attrs.sender()
		}

		const senderName = sender?.name || message.sender

		switch (message.type) {

			case "SENT": {

				if (isEmoji(message.content)) {
					return (
						<div key={vnode.attrs.key} class="message sent">
							<div class="bubble">
								<div class="margin-none padding-top-lg padding-bottom-sm" style="font-size:48px;">{message.content}</div>
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
					<div key={vnode.attrs.key} class="message sent">
						<div class="bubble">
							{this.drawContent(controller, message)}
							{this.drawReactions(vnode)}
						</div>
					</div>
				)
			}

			case "RECEIVED": {

				if (isEmoji(message.content)) {
					return (
						<div key={vnode.attrs.key} class="message received">

							<div class="sender-icon">
								{(sender != undefined) && <img src={sender.icon} class="circle width-48" alt="" />}
							</div>

							<div class="flex-grow">
								{(sender != undefined) && (
									<div class="sender">{sender.name || "..."}</div>
								)}
								<div class="bubble">
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
					<div key={vnode.attrs.key} class="message received">

						<div class="sender-icon">
							{(sender != undefined) && <img src={sender.icon} class="circle width-48" alt="" />}
						</div>

						<div class="flex-grow">
							{(sender != undefined) && (
								<div class="sender">{sender.name || "..."}</div>
							)}
							<div class="bubble">
								{this.drawContent(controller, message)}
								{this.drawReactions(vnode)}
							</div>
						</div>
					</div>
				)
			}

			case "ADD-ACTOR": {

				const contact = vnode.attrs.controller.getContactStream(message.sender)()

				return (
					<div key={vnode.attrs.key} class="message status">
						<div>
							<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)} onkeypress={synthClick}>
								<img src={contact.icon} class="circle margin-right-xs" style="height:1em;" alt="" />
								{contact.name}
							</span> {" "}
							JOINED the conversation at {dayjs(message.createDate).format("h:mm A")}
						</div>
					</div>
				)
			}

			case "REMOVE-ACTOR": {

				const contact = vnode.attrs.controller.getContactStream(message.sender)()

				return (
					<div class="message status">
						<div>
							<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)} onkeypress={synthClick}>
								<img src={contact.icon} class="circle margin-right-xs" style="height:1em;" alt="" />
								{contact.name}
							</span> {" "}
							left the conversation at {dayjs(message.createDate).format("h:mm A")}
						</div>
					</div>
				)
			}

			case "ADD-DEVICE": {

				return (
					<div class="message status">
						<span class="link" role="button" tabIndex="0" onclick={() => controller.host_actor(message.sender)} onkeypress={synthClick}>{senderName}</span> {" "}
						ADDED a new device
					</div>
				)
			}

			case "REMOVE-DEVICE":
		}

		throw new Error(`Unknown message type: ${message.type}`)
	}

	drawContent(controller: ViewController, message: Message): JSX.Element {

		return <>
			{message.attachments.map(attachment => (
				attachment.startsWith("data:image") ? (
					<><img src={attachment} class="width-100% rounded" alt="" /> {/* NOSONAR: typescript:S6853 */}</>
				) : (
					<a href={attachment} class="attachment" target="_blank" rel="noopener noreferrer"> {/* NOSONAR: typescript:S6853 */}
						<i class="bi bi-file-earmark-arrow-down"></i> Download File ({formatFileSize(attachment.length)})
					</a>
				)
			))}
			{/* NOSONAR S6848/S1082: the interactive elements are the native <a> mentions
			    inside the trusted HTML; this is a delegation layer that also handles keyboard. */}
			<div class="padding-xs message-content" onclick={(event: MouseEvent) => this.onContentClick(controller, event)} onkeydown={(event: KeyboardEvent) => this.onContentKeydown(controller, event)}>{m.trust(message.content)}</div>
		</>

	}

	// mentionActorId returns the profile URL of the mention link containing the given
	// event target, or "" if the target is not inside a mention. Mentions are
	// identified by the Mastodon ".h-card" microformat wrapper, and the href is the
	// actor's profile URL (the WebFinger "self" link).
	mentionActorId(target: EventTarget | null): string {
		const anchor = (target as HTMLElement | null)?.closest(".h-card a") as HTMLAnchorElement | null
		return anchor?.getAttribute("href") ?? ""
	}

	// onContentClick intercepts clicks on @mention links inside rendered message
	// content (an inert m.trust island) and routes them to the host's profile viewer
	// instead of navigating to the remote profile URL.
	onContentClick(controller: ViewController, event: MouseEvent) {
		const actorId = this.mentionActorId(event.target)
		if (actorId == "") {
			return
		}
		event.preventDefault()
		controller.host_actor(actorId)
	}

	// onContentKeydown handles keyboard activation (Enter/Space) of a focused mention
	// link, routing it to the host profile viewer like a click.
	onContentKeydown(controller: ViewController, event: KeyboardEvent) {
		if (event.key != "Enter" && event.key != " ") {
			return
		}
		const actorId = this.mentionActorId(event.target)
		if (actorId == "") {
			return
		}
		event.preventDefault()
		controller.host_actor(actorId)
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
								return <button key={content}>{content} {reactionCount}</button>
							}

							// Show my reaction as selected and allow me to undo
							if (hasReacted) {
								return <button key={content} class="selected" onclick={() => controller.undoReaction(message.id)}>{content} {reactionCount}</button>
							}

							// Show unselected reactions that I can also join
							return <button key={content} tabIndex="0" onclick={() => controller.reactToMessage(message.id, content)}>{content} {reactionCount}</button>
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
					{vnode.attrs.message.received.map(actorId => <i key={actorId} class="bi bi-check-circle" style="margin-right:2px;" title={`Received by ${actorId}`}></i>)}
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
				role="button"
				tabIndex="0"
				onclick={() => vnode.attrs.controller.modal_messageHistory(message.id)}
				onkeypress={synthClick}>
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
