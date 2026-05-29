import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import type { Message } from "../model/message"
import { groupIsEncrypted } from "../model/group"
import { synthClick } from "./utils"

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

		const controller = vnode.attrs.controller
		const group = controller.groupStream()
		const isEncrypted = groupIsEncrypted(group)

		// Do not allow the user to add more messages if this group is closed.
		if (group.stateId === "CLOSED") {
			return <div class="card padding-vertical-xl padding-horizontal align-center bg-stripes">
				This conversation is closed. You can no longer send messages here.
				But you can <span class="link" role="button" tabIndex="0" onclick={() => controller.modal_newConversation()} onkeypress={synthClick}>start a new conversation</span>.
			</div>
		}

		let backgroundStyle = ""

		if (!isEncrypted) {
			backgroundStyle = `background: repeating-linear-gradient(135deg,rgba(127, 127, 127, 0.1), rgba(127, 127, 127, 0.1) 10px, rgba(255, 255, 255, 0.1) 10px, rgba(255, 255, 255, 0.1) 20px);`
		}

		return <>

			{isEncrypted ?
				<div class="text-sm text-gray"><i class="bi bi-lock-fill"></i> encrypted conversation</div>
				:
				<div class="text-sm padding-xs bold bg-stripes"><i class="bi bi-exclamation-triangle-fill"></i> NOT ENCRYPTED</div>
			}

			<div class="flex-row flex-justify" style={backgroundStyle}>
				<div class="flex-grow">
					{this.drawReply(vnode)}
					<div role="textbox" class="flex-grow flex-row flex-align-center">

						<textarea
							id="message-input"
							value={vnode.state.message}
							style="border:none; min-height:1em; field-sizing:content; resize:none;"
							oninput={(e: Event) => this.oninput(vnode, e)}
							onkeydown={(e: KeyboardEvent) => this.onkeydown(vnode, e)}></textarea>

						<button
							tabIndex="0"
							onclick={() => controller.modal_sendEmoji()}
							style="font-size:16px;"><i class="bi bi-emoji-smile"></i></button>

						{/* NOSONAR: typescript:S6853 */} <label
							for="fileInput"
							class="button"
							aria-label="Attach a File"
							style="font-size:16px;"><i class="bi bi-image"></i></label>

					</div>
				</div>

				<input
					type="file"
					id="fileInput"
					style="display:none;"
					onchange={(e: Event) => this.sendFile(vnode, e)}>
				</input>
			</div>
		</>
	}

	drawReply(vnode: WidgetMessageCreateVnode) {

		// If no InReplyTo message is set, then do not draw the reply card
		if (vnode.attrs.inReplyTo == undefined) {
			return null
		}

		return (
			<div id="reply-panel" oncreate={() => document.getElementById("message-input")}>
				<div><i class="bi bi-x-circle-fill clickable" role="button" tabIndex="0" onclick={() => vnode.attrs.controller.removeReply()} onkeypress={synthClick}></i></div>
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

	sendFile(vnode: WidgetMessageCreateVnode, event: Event) {

		const target = event.target as HTMLInputElement
		if (!target.files || target.files.length === 0) {
			return
		}

		const file = target.files[0]

		if (!file) {
			console.error("No file selected.")
			return
		}

		const reader = new FileReader()
		reader.onload = () => {
			let base64: string = reader.result as string

			if (reader.result == null) {
				return
			}

			vnode.attrs.controller.sendFile(base64)
		}

		reader.onerror = () => {
			console.error("Error reading file:", reader.error)
		}

		reader.readAsDataURL(file)

	}
}
