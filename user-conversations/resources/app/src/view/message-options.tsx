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

	view(vnode: MessageOptionsVnode): JSX.Element | undefined {

		const controller = vnode.attrs.controller
		const message = vnode.attrs.message
		const reactions = Object.entries(message.reactions)
		const isSentByMe = (message.sender == controller.actorId())
		const hasReactions = (reactions.length > 0)
		const defaultEmojis = ["❤️", "👍", "👎", "😂", "😮", "😢"]

		if (isSentByMe) {
			return (
				<div class="message-options">
					<div class="content">
						<button class="text-sm" onclick={() => controller.startReply(message)}><i class="bi bi-reply"></i> Reply</button>
						<button class="text-sm" onclick={() => controller.modal_editMessage(message.id)}><i class="bi bi-pencil-square"></i> Edit</button>
						<button class="text-sm" onclick={() => controller.deleteMessage(message.id)}><i class="bi bi-trash"></i></button>
					</div>
				</div>
			)
		}

		return (
			<div class="message-options">

				<div class="content">
					{defaultEmojis.map(emoji => {
						const hasReacted = message.reactions[emoji]?.includes(controller.actorId())

						if (hasReacted) {
							return <button class="selected circle text-sm" onclick={() => controller.undoReaction(message.id)}>{emoji}</button>
						} else {
							return <button class="circle text-sm" onclick={() => controller.reactToMessage(message.id, emoji)}>{emoji}</button>
						}
					})}
					<button class="circle text-sm" style="font-size:8px; height:33px; width:33px; display:inline-flex; align-items:center; justify-content:center;" onclick={() => alert("Emoji picker coming soon!")}>&#183;&#183;&#183;</button>
					&nbsp;
					<button class="text-sm" onclick={() => controller.startReply(message)}><i class="bi bi-reply"></i> Reply</button>
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
