import m from "mithril"
import { type Vnode } from "mithril"
import { type Message } from "../model/message"
import { NewContact, type Contact } from "../model/contact"
import { Controller } from "../service/controller"

type MessageOptionsVnode = Vnode<MessageOptionsAttrs, MessageOptionsState>

type MessageOptionsAttrs = {
	controller: Controller
	message: Message
	open: boolean
}

type MessageOptionsState = {
	open: boolean
	showEmojis: boolean
}

export class MessageOptions {

	oninit(vnode: MessageOptionsVnode) {
		vnode.state.open = vnode.attrs.open
	}

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	oldview(vnode: MessageOptionsVnode) {

		const controller = vnode.attrs.controller

		// List the messages in the selected group
		const defaultEmojis = ["👍", "❤️", "😂"]

		// Define smaller, default, "closed state" first
		return (
			<div>
				<div class="text-sm">
					{defaultEmojis.map(emoji => <button class="margin-none" onclick={() => this.sendReaction(vnode, emoji)}>{emoji}</button>)}
				</div>
				<div class="hover-show">
					<div class="pos-absolute" style="z-index:1000;">
						<div class="card padding text-sm width-100%">
							{defaultEmojis.map(emoji => <button class="margin-none" onclick={() => this.sendReaction(vnode, emoji)}>{emoji}</button>)}
							<button class="margin-none" title="reply" onclick={() => this.startReply(vnode)}><i class="bi bi-reply"></i></button>
							{this.editButtons(vnode)}
						</div>
					</div>
				</div>
			</div>
		)
	}

	view(vnode: MessageOptionsVnode): JSX.Element | undefined {

		const defaultEmojis = ["❤️", "👍", "👎", "😂", "😮", "😢"]
		const controller = vnode.attrs.controller
		const message = vnode.attrs.message
		const reactions = Object.entries(message.reactions)
		const isMe = (message.sender == controller.actorId())

		return (
			<div class="flex-row flex-align-center">

				{(reactions.length > 0) &&
					<div class="margin-top-sm">
						{reactions.map(([content, actors]) => {
							const hasReacted = message.reactions[content]?.includes(controller.actorId())
							const reactionCount = (actors.length > 1) ? actors.length : ""

							if (isMe) {
								return <button>{content} {reactionCount}</button>
							}

							if (hasReacted) {
								return <button class="selected text-sm" onclick={() => controller.undoReaction(message.id)}>{content} {reactionCount}</button>
							}
							return <button class="transparent text-sm" onclick={() => controller.reactToMessage(message.id, content)}>{content} {reactionCount}</button>
						})}
					</div>
				}

				{isMe ||
					<div class="hover-show margin-top-sm">
						{defaultEmojis.map(emoji => {
							const hasReacted = message.reactions[emoji]?.includes(controller.actorId())

							if (hasReacted) {
								return <button class="selected circle text-sm" onclick={() => controller.undoReaction(message.id)}>{emoji}</button>
							} else {
								return <button class="circle text-sm" onclick={() => controller.reactToMessage(message.id, emoji)}>{emoji}</button>
							}
						})}
						<button class="circle text-sm" style="font-size:8px; height:33px; width:33px; display:inline-flex; align-items:center; justify-content:center;" onclick={() => alert("Emoji picker coming soon!")}>&#183;&#183;&#183;</button>
					</div>
				}

				<div class="hover-show margin-top-sm margin-left">
					<button class="text-sm" onclick={() => controller.startReply(message)}><i class="bi bi-reply"></i> Reply</button>

					{isMe && [
						<button class="text-sm" onclick={() => controller.modal_editMessage(message.id)}><i class="bi bi-pencil-square"></i> Edit</button>,
						<button class="text-sm" onclick={() => controller.deleteMessage(message.id)}><i class="bi bi-trash"></i></button>
					]}
				</div>

			</div>
		)
	}

	editButtons(vnode: MessageOptionsVnode) {

		if (vnode.attrs.message.type != "SENT") {
			return null
		}

		return <span>
			<button class="margin-none" title="edit" onclick={() => this.edit(vnode)}><i class="bi bi-pencil-square"></i></button>
			<button class="margin-none text-red" title="delete" onclick={() => this.delete(vnode)}><i class="bi bi-trash"></i></button>
		</span>
		/*
		console.log("Calculating likes for message:", message)

		// I can only like messages that I have received
		if (message.type == "RECEIVED") {

			// If there are already reactions, then display them
			if (message.reactions.length > 0) {

				if (message.likes.includes(vnode.attrs.controller.actorId())) {
					console.log("A")
					return (
						<span class="clickable" onclick={() => vnode.attrs.controller.undoLikeMessage(message.id)}>
							<i class="bi bi-heart-fill text-red margin-right-xs"></i>
							{(message.likes.length) > 1 ? message.likes.length : ""}
						</span>
					)
				}

				console.log("B")
				return (
					<span class="clickable" onclick={() => vnode.attrs.controller.likeMessage(message.id)}>
						<i class="bi bi-heart-fill margin-right-xs"></i>
						{(message.likes.length) > 1 ? message.likes.length : ""}
					</span>
				)
			}

			console.log("C")
			// No likes yet, so display an empty heart widget
			return (
				<span class="clickable" onclick={() => vnode.attrs.controller.likeMessage(message.id)}>
					<i class="bi bi-heart margin-right-xs"></i>
				</span>
			)
		}

		// Fallthrough means this is a message I have sent, so I can't add a like
		// If there are likes, then display them
		if (message.likes.length > 0) {
			console.log("D")

			return (
				<span>
					<i class="bi bi-heart-fill margin-right-xs"></i>
					{(message.likes.length) > 1 ? message.likes.length : ""}
				</span>
			)
		}

		// Otherwise, empty
		console.log("E")
		return <span></span>


							<div class="pos-absolute-top-right text-sm">
								<i class="bi bi-pencil-square margin-right hover-show clickable"
									onclick={() => controller.modal_editMessage(message.id)}></i>
								<i class="bi bi-trash margin-right hover-show clickable"
									onclick={() => { if (confirm("Are you sure you want to delete this message?")) { vnode.attrs.controller.deleteMessage(message.id) } }}></i>
							</div>
		*/


		/* Define larger, "open" state
		return (
			<div class="hover-show pos-absolute" style="width:100%; z-index:1000;" onmouseleave={() => this.close(vnode)}>

				<div class="card pos-relative" style="width:100%; max-width:480px;">

					<span>All</span>
					<span>Face</span>
					<span></span>

					<div class="table">
						<div class="padding-horizontal-sm">
							{defaultEmojis.map(emoji => <button onclick={() => this.sendReaction(vnode, emoji)}>{emoji}</button>)}
							<button onclick={() => vnode.state.showEmojis = true}>&hellip;</button>
						</div>

						<div role="button" class="padding-horizontal-sm" onclick={() => this.sendReply(vnode)}><i class="bi bi-reply"></i> Reply</div>
						<div role="button" class="padding-horizontal-sm" onclick={() => console.log("Copy clicked")}><i class="bi bi-clipboard"></i> Copy</div>
						<div role="button" class="padding-horizontal-sm" onclick={() => console.log("Edit clicked")}><i class="bi bi-pencil-square"></i> Edit</div>
						<div role="button" class="padding-horizontal-sm text-red" onclick={() => console.log("Delete clicked")}><i class="bi bi-trash"></i> Delete</div>
					</div>

				</div>
			</div>
			*/

	}

	sendReaction(vnode: MessageOptionsVnode, content: string) {
		vnode.attrs.controller.reactToMessage(vnode.attrs.message.id, content)
		this.close(vnode)
	}

	showMenu(vnode: MessageOptionsVnode) {
		vnode.state.open = true
	}

	copy(vnode: MessageOptionsVnode) {
		navigator.clipboard.writeText(vnode.attrs.message.content)
		alert("Message copied to clipboard")
		this.close(vnode)
	}

	edit(vnode: MessageOptionsVnode) {
		console.log("edit clicked")
		vnode.attrs.controller.modal_editMessage(vnode.attrs.message.id)
		this.close(vnode)
	}

	delete(vnode: MessageOptionsVnode) {
		if (confirm("Are you sure you want to delete this message?")) {
			vnode.attrs.controller.deleteMessage(vnode.attrs.message.id)
		}
		this.close(vnode)
	}

	startReply(vnode: MessageOptionsVnode) {
		vnode.attrs.controller.startReply(vnode.attrs.message)
		document.getElementById("message-input")?.focus()
		this.close(vnode)
	}

	close(vnode: MessageOptionsVnode) {
		vnode.state.open = false
		vnode.state.showEmojis = false
	}
}
