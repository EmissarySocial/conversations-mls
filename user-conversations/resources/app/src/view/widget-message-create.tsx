import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import type { Message } from "../model/message"

type WidgetMessageCreateVnode = Vnode<WidgetMessageCreateAttrs, WidgetMessageCreateState>

type WidgetMessageCreateAttrs = {
	controller: Controller
	inReplyTo: Message | undefined
}

type WidgetMessageCreateState = {
	message: string
}

export class WidgetMessageCreate {
	oninit(vnode: WidgetMessageCreateVnode) {
		vnode.state.message = ""
	}

	view(vnode: WidgetMessageCreateVnode) {

		// Do not allow the user to add more messages if this group is closed.
		if (vnode.attrs.controller.group.stateId === "CLOSED") {
			return <div class="card padding align-center">
				This conversation is closed. You can no longer send messages here.
				But you can <span class="link" onclick={() => vnode.attrs.controller.modal_newConversation()}>start a new conversation</span>.
			</div>
		}

		const enabled = vnode.state.message.trim() !== ""
		const disabled = !enabled

		const color = enabled ? "var(--blue50)" : "var(--gray30)"

		return (
			<div class="flex-row flex-justify">
				<div class="flex-grow">
					{this.drawReply(vnode)}
					<div role="input" class="flex-grow flex-row flex-align-center">

						<textarea
							id="message-input"
							value={vnode.state.message}
							style="border:none; min-height:1em; field-sizing:content; resize:none;"
							oninput={(e: Event) => this.oninput(vnode, e)}
							onkeydown={(e: KeyboardEvent) => this.onkeydown(vnode, e)}></textarea>

						<button
							tabIndex="0"
							onclick={() => alert("Emoji picker coming soon!")}
							style="font-size:16px;"><i class="bi bi-emoji-smile"></i></button>

						<label
							for="fileInput"
							class="button"
							tabIndex="0"
							style="font-size:16px;"><i class="bi bi-image"></i></label>

					</div>
				</div>
				<input type="file" id="fileInput" style="display:none;" />
			</div>
		)
	}

	drawReply(vnode: WidgetMessageCreateVnode) {

		// If no InReplyTo message is set, then do not draw the reply card
		if (vnode.attrs.inReplyTo == undefined) {
			return null
		}

		return (
			<div id="reply-panel" oncreate={() => document.getElementById("message-input")}>
				<div><i class="bi bi-x-circle-fill clickable" tabIndex="0" onclick={() => vnode.attrs.controller.removeReply()}></i></div>
				<div class="margin-horizontal-sm bold">Replying To:</div>
				<div class="flex-grow">{vnode.attrs.inReplyTo.content}</div>
			</div>
		)
	}

	// Send message on enter (but not shift+enter)
	onkeydown(vnode: WidgetMessageCreateVnode, event: KeyboardEvent) {

		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			this.sendMessage(vnode)
			return
		}
	}

	oninput(vnode: WidgetMessageCreateVnode, event: Event) {

		// Update the message state as the user types
		const target = event.target as HTMLTextAreaElement
		vnode.state.message = target.value
	}

	sendMessage(vnode: WidgetMessageCreateVnode) {

		// RULE: Do not send empty messages
		if (vnode.state.message.trim() === "") {
			return
		}

		vnode.attrs.controller.sendMessage(vnode.state.message)
		vnode.state.message = ""
	}
}
