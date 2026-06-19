import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import type { Message } from "../model/message"
import type { Emoji } from "../model/emoji"
import { groupIsEncrypted } from "../model/group"
import { synthClick } from "./utils"
import { MentionPopup, type MentionPopupController } from "./widget-mention-popup"
import { PickEmoji } from "./modal-pickEmoji"
import { activeMentionToken, replaceMentionToken, type MentionToken } from "./mentionToken"
import { caretCoordinates } from "./caretCoordinates"

const MESSAGE_INPUT_ID = "message-input"

type WidgetMessageCreateVnode = Vnode<WidgetMessageCreateAttrs, WidgetMessageCreateState>

type WidgetMessageCreateAttrs = {
	controller: Controller
	inReplyTo: Message | undefined
}

// MentionContext describes an in-progress @mention: the token being typed and the
// viewport coordinates at which to anchor the autocomplete popup. `bottom` is the
// distance from the viewport's bottom edge to the caret line — the popup pins its
// bottom edge there and opens upward.
interface MentionContext {
	token: MentionToken
	left: number
	bottom: number
}

type WidgetMessageCreateState = {
	message: string
	// mention is the active @mention autocomplete context, or null when none is open.
	mention: MentionContext | null
	// mentionPopup is the popup's imperative handle, used to route keyboard nav.
	mentionPopup?: MentionPopupController
	// savedCaret is the caret position captured when the emoji picker is opened,
	// before the modal steals focus from the textarea.
	savedCaret?: number
	// showEmojiPicker is true while this composer's own emoji picker modal is open.
	showEmojiPicker: boolean
}

export class WidgetMessageCreate {
	oninit(vnode: WidgetMessageCreateVnode) {
		vnode.state.message = ""
		vnode.state.mention = null
		vnode.state.showEmojiPicker = false
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
				<div class="text-sm padding-xs text-gray"><i class="bi bi-lock-fill"></i> PRIVATE MESSAGE (encrypted)</div>
				:
				<div class="text-sm padding-xs bold bg-stripes"><i class="bi bi-exclamation-triangle-fill"></i> DIRECT MESSAGE (not encrypted)</div>
			}

			<div class="flex-row flex-justify" style={backgroundStyle}>
				<div class="flex-grow">
					{this.drawReply(vnode)}
					<div role="textbox" class={"flex-grow flex-row flex-align-center" + (isEncrypted ? "" : " unencrypted-textbox")}>

						<textarea
							id={MESSAGE_INPUT_ID}
							value={vnode.state.message}
							style="border:none; min-height:1em; field-sizing:content; resize:none;"
							oninput={(e: Event) => this.oninput(vnode, e)}
							onkeydown={(e: KeyboardEvent) => this.onkeydown(vnode, e)}
							onkeyup={(e: KeyboardEvent) => this.syncMention(vnode, e.target as HTMLTextAreaElement)}
							onclick={(e: MouseEvent) => this.syncMention(vnode, e.target as HTMLTextAreaElement)}
							onblur={() => this.closeMention(vnode)}></textarea>

						{this.drawMentionPopup(vnode)}

						{vnode.state.showEmojiPicker &&
							<PickEmoji
								onselect={(emoji: Emoji) => this.insertEmoji(vnode, emoji.emoji)}
								close={() => this.closeEmojiPicker(vnode)} />
						}

						<button
							tabIndex="0"
							onclick={() => this.openEmojiPicker(vnode)}
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

	onkeydown(vnode: WidgetMessageCreateVnode, event: KeyboardEvent) {

		// While the mention popup is open, navigation keys drive the popup instead
		// of editing or sending the message.
		if (this.mentionPopupIsActive(vnode)) {
			if (this.handleMentionKey(vnode, event)) {
				return
			}
		}

		// Send message on Enter (but not Shift+Enter)
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault()
			this.sendMessage(vnode)
		}
	}

	// mentionPopupIsActive reports whether the autocomplete popup is open with results.
	mentionPopupIsActive(vnode: WidgetMessageCreateVnode): boolean {
		return (vnode.state.mention != null) && (vnode.state.mentionPopup?.isActive() ?? false)
	}

	// handleMentionKey routes a navigation key to the open popup. It returns true if
	// the key was consumed (and the caller should do nothing further).
	handleMentionKey(vnode: WidgetMessageCreateVnode, event: KeyboardEvent): boolean {

		const popup = vnode.state.mentionPopup

		switch (event.key) {

			case "ArrowDown":
				event.preventDefault()
				popup?.moveHighlight(1)
				return true

			case "ArrowUp":
				event.preventDefault()
				popup?.moveHighlight(-1)
				return true

			case "Enter":
			case "Tab":
				event.preventDefault()
				popup?.selectHighlighted()
				return true

			case "Escape":
				event.preventDefault()
				this.closeMention(vnode)
				return true

			default:
				return false
		}
	}

	oninput(vnode: WidgetMessageCreateVnode, event: Event) {

		// Update the message state as the user types
		const target = event.target as HTMLTextAreaElement
		vnode.state.message = target.value

		// Recompute the active @mention (if any) and its popup position
		this.syncMention(vnode, target)
	}

	//////////////////////////////////////////
	// @mention autocomplete

	// drawMentionPopup renders the autocomplete popup when a mention is in progress.
	drawMentionPopup(vnode: WidgetMessageCreateVnode): m.Children {

		const mention = vnode.state.mention
		if (mention == null) {
			return null
		}

		return (
			<MentionPopup
				controller={vnode.attrs.controller}
				query={mention.token.query}
				left={mention.left}
				bottom={mention.bottom}
				onselect={(handle: string) => this.insertMention(vnode, handle)}
				onready={(popup: MentionPopupController) => { vnode.state.mentionPopup = popup }} />
		)
	}

	// syncMention recomputes the active @mention token from the field's caret and
	// updates (or clears) the popup context accordingly.
	syncMention(vnode: WidgetMessageCreateVnode, field: HTMLTextAreaElement) {

		const token = activeMentionToken(field.value, field.selectionStart)

		if (token == null) {
			this.closeMention(vnode)
			return
		}

		// Anchor the popup's bottom edge just above the caret line so it opens upward
		// (the composer sits at the bottom of the screen).
		const caret = caretCoordinates(field, token.start)
		vnode.state.mention = {
			token,
			left: caret.left,
			bottom: window.innerHeight - caret.top,
		}
	}

	// closeMention dismisses the popup and clears its context.
	closeMention(vnode: WidgetMessageCreateVnode) {
		if (vnode.state.mention != null) {
			vnode.state.mention = null
			m.redraw()
		}
	}

	// insertMention replaces the in-progress token with the chosen "@user@host"
	// handle (plus a trailing space), restores the caret, and closes the popup.
	insertMention(vnode: WidgetMessageCreateVnode, handle: string) {

		const mention = vnode.state.mention
		if (mention == null) {
			return
		}

		const { text, caret } = replaceMentionToken(vnode.state.message, mention.token, handle + " ")
		vnode.state.mention = null
		this.applyComposedText(vnode, text, caret)
	}

	// openEmojiPicker snapshots the caret position (before the modal steals focus
	// from the textarea) and opens this composer's own emoji picker.
	openEmojiPicker(vnode: WidgetMessageCreateVnode) {
		const field = document.getElementById(MESSAGE_INPUT_ID) as HTMLTextAreaElement | null
		vnode.state.savedCaret = field?.selectionStart ?? vnode.state.message.length
		vnode.state.showEmojiPicker = true
	}

	// closeEmojiPicker dismisses the emoji picker, mirroring the modal-router's
	// fade-out: drop the #modal "ready" class, then unmount after the transition.
	closeEmojiPicker(vnode: WidgetMessageCreateVnode) {
		document.getElementById("modal")?.classList.remove("ready")
		globalThis.setTimeout(() => {
			vnode.state.showEmojiPicker = false
			m.redraw()
		}, 240)
	}

	// insertEmoji inserts an emoji at the caret position captured when the picker was
	// opened (defaulting to the end of the text), then restores the caret just past
	// it. Used by the emoji picker instead of sending the emoji as its own message.
	insertEmoji(vnode: WidgetMessageCreateVnode, emoji: string) {

		const at = vnode.state.savedCaret ?? vnode.state.message.length
		delete vnode.state.savedCaret

		const text = vnode.state.message.slice(0, at) + emoji + vnode.state.message.slice(at)
		this.applyComposedText(vnode, text, at + emoji.length)
	}

	// applyComposedText commits new composer text and restores the caret to `caret`.
	// The caret is set after the redraw (via rAF) so the textarea reflects the new
	// value first.
	applyComposedText(vnode: WidgetMessageCreateVnode, text: string, caret: number) {

		vnode.state.message = text

		const field = document.getElementById(MESSAGE_INPUT_ID) as HTMLTextAreaElement | null
		requestAnimationFrame(() => {
			if (field != null) {
				field.focus()
				field.setSelectionRange(caret, caret)
			}
		})

		m.redraw()
	}

	sendMessage(vnode: WidgetMessageCreateVnode) {

		// RULE: Do not send empty messages
		if (vnode.state.message.trim() === "") {
			return
		}

		vnode.attrs.controller.sendMessage(vnode.state.message)
		vnode.state.message = ""
		vnode.state.mention = null
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
