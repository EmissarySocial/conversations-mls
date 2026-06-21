import m, { type Vnode } from "mithril"
import { type Attachment, attachmentIcon, attachmentKind } from "../model/message"
import { ViewController } from "./controller"
import { Modal } from "./modal"
import { formatFileSize } from "./utils"

// SWIPE_THRESHOLD is the minimum horizontal travel (in pixels) of a touch gesture
// that counts as a swipe to the next/previous attachment.
const SWIPE_THRESHOLD = 50

type AttachmentsVnode = Vnode<AttachmentsAttrs, AttachmentsState>

interface AttachmentsAttrs {
	controller: ViewController
	close: () => void
}

interface AttachmentsState {
	// index is the attachment currently displayed in the lightbox.
	index: number
	// touchStartX is the X coordinate where the current touch gesture began, or
	// null when no gesture is in progress.
	touchStartX: number | null
}

// Attachments is the full-screen attachment lightbox. It shows one attachment at
// a time (image, video, audio player, or download card) and lets the user move
// between multiple attachments with on-screen arrows, the keyboard, or a swipe.
export class Attachments {

	oninit(vnode: AttachmentsVnode) {
		vnode.state.index = vnode.attrs.controller.modalAttachmentIndex
		vnode.state.touchStartX = null
	}

	oncreate() {
		// The lightbox uses the global "huge" modal size for maximum viewing area
		document.getElementById("modal-window")?.classList.add("huge")
	}

	view(vnode: AttachmentsVnode) {

		const attachments = vnode.attrs.controller.modalAttachments
		const current = attachments[vnode.state.index]

		if (current == undefined) {
			return <Modal close={vnode.attrs.close}></Modal>
		}

		const hasMultiple = attachments.length > 1

		return (
			<Modal close={vnode.attrs.close}>
				<div
					id="attachment-viewer"
					onkeydown={(event: KeyboardEvent) => this.onkeydown(vnode, event)}
					ontouchstart={(event: TouchEvent) => this.ontouchstart(vnode, event)}
					ontouchend={(event: TouchEvent) => this.ontouchend(vnode, event)}>

					<button
						type="button"
						class="attachment-close"
						aria-label="Close"
						tabIndex="0"
						onclick={vnode.attrs.close}><i class="bi bi-x-lg"></i></button>

					{hasMultiple &&
						<button
							type="button"
							class="attachment-nav attachment-prev"
							aria-label="Previous attachment"
							tabIndex="0"
							onclick={() => this.previous(vnode)}><i class="bi bi-chevron-left"></i></button>
					}

					<div class="attachment-stage flex-grow flex-row flex-align-center flex-justify">
						{this.drawAttachment(current)}
					</div>

					{hasMultiple &&
						<button
							type="button"
							class="attachment-nav attachment-next"
							aria-label="Next attachment"
							tabIndex="0"
							onclick={() => this.next(vnode)}><i class="bi bi-chevron-right"></i></button>
					}

					{hasMultiple &&
						<div class="attachment-counter text-sm">{vnode.state.index + 1} / {attachments.length}</div>
					}
				</div>
			</Modal>
		)
	}

	// drawAttachment renders the body for a single attachment, choosing the player
	// or download card that matches its kind.
	drawAttachment(attachment: Attachment): JSX.Element {

		switch (attachmentKind(attachment)) {

			case "image":
				return <img src={attachment.url} class="attachment-media" alt={attachment.name} /> // NOSONAR: typescript:S6853

			case "video":
				return <video src={attachment.url} class="attachment-media" controls autoplay></video>

			case "audio":
				return (
					<div class="attachment-audio flex-column flex-align-center flex-justify">
						<i class={"bi " + attachmentIcon(attachment)}></i>
						<div class="margin-bottom">{attachment.name || "Audio"}</div>
						<audio src={attachment.url} controls autoplay></audio>
					</div>
				)

			default:
				return (
					<a
						href={attachment.url}
						download={attachment.name || true}
						class="attachment-download flex-column flex-align-center flex-justify"
						target="_blank"
						rel="noopener noreferrer">
						<i class={"bi " + attachmentIcon(attachment)}></i>
						<div class="bold">{attachment.name || "Download File"}</div>
						{(attachment.size > 0) && <div class="text-sm text-gray">{formatFileSize(attachment.size)}</div>}
						<div class="button margin-top"><i class="bi bi-download"></i> Download</div>
					</a>
				)
		}
	}

	// previous moves to the prior attachment, wrapping to the end.
	previous(vnode: AttachmentsVnode) {
		const count = vnode.attrs.controller.modalAttachments.length
		vnode.state.index = (vnode.state.index - 1 + count) % count
	}

	// next moves to the following attachment, wrapping to the start.
	next(vnode: AttachmentsVnode) {
		const count = vnode.attrs.controller.modalAttachments.length
		vnode.state.index = (vnode.state.index + 1) % count
	}

	// onkeydown maps the Left/Right arrow keys to attachment navigation.
	onkeydown(vnode: AttachmentsVnode, event: KeyboardEvent) {

		switch (event.key) {

			case "ArrowLeft":
				event.preventDefault()
				this.previous(vnode)
				return

			case "ArrowRight":
				event.preventDefault()
				this.next(vnode)
		}
	}

	// ontouchstart records the starting X coordinate of a touch gesture.
	ontouchstart(vnode: AttachmentsVnode, event: TouchEvent) {
		vnode.state.touchStartX = event.changedTouches[0]?.clientX ?? null
	}

	// ontouchend completes a swipe gesture, advancing to the next or previous
	// attachment when the horizontal travel exceeds SWIPE_THRESHOLD.
	ontouchend(vnode: AttachmentsVnode, event: TouchEvent) {

		const startX = vnode.state.touchStartX
		vnode.state.touchStartX = null

		if (startX == null) {
			return
		}

		const endX = event.changedTouches[0]?.clientX ?? startX
		const deltaX = endX - startX

		// RULE: Ignore small movements that are taps rather than swipes
		if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
			return
		}

		if (deltaX > 0) {
			this.previous(vnode)
		} else {
			this.next(vnode)
		}

		m.redraw()
	}
}
