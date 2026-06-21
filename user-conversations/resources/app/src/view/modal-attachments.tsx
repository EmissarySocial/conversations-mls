import m, { type Vnode } from "mithril"
import { type Attachment, attachmentIcon, attachmentKind } from "../model/message"
import { ViewController } from "./controller"
import { Modal } from "./modal"
import { formatFileSize } from "./utils"

// SWIPE_THRESHOLD is the minimum horizontal travel (in pixels) of a pointer
// gesture that counts as a swipe to the next/previous attachment.
const SWIPE_THRESHOLD = 50

// DRAG_SLOP is the small movement (in pixels) tolerated before a press is treated
// as a drag rather than a click, so taps on controls are not stolen.
const DRAG_SLOP = 8

type AttachmentsVnode = Vnode<AttachmentsAttrs, AttachmentsState>

interface AttachmentsAttrs {
	controller: ViewController
	close: () => void
}

interface AttachmentsState {
	// index is the attachment currently displayed in the lightbox.
	index: number
	// drag holds the in-progress pointer gesture, or null when none is active.
	drag: DragState | null
}

// DragState tracks a pointer gesture from press to release across the stage.
interface DragState {
	startX: number
	startY: number
	// onMedia is true when the gesture began on a <video>/<audio>/<a>, so the
	// native control keeps its click while a clear horizontal swipe still navigates.
	onMedia: boolean
	// moved is true once the pointer has traveled past DRAG_SLOP.
	moved: boolean
}

// Attachments is the full-screen attachment lightbox. It shows the attachments as
// a sliding track and lets the user move between them with the on-screen arrows,
// the keyboard, or a mouse/touch swipe. Navigation does not wrap.
export class Attachments {

	oninit(vnode: AttachmentsVnode) {
		vnode.state.index = vnode.attrs.controller.modalAttachmentIndex
		vnode.state.drag = null
	}

	oncreate() {
		// The lightbox uses the global "huge" modal size for maximum viewing area
		document.getElementById("modal-window")?.classList.add("huge")
	}

	view(vnode: AttachmentsVnode) {

		const attachments = vnode.attrs.controller.modalAttachments

		if (attachments.length == 0) {
			return <Modal close={vnode.attrs.close}></Modal>
		}

		const hasMultiple = attachments.length > 1
		const atStart = vnode.state.index <= 0
		const atEnd = vnode.state.index >= attachments.length - 1

		return (
			<Modal close={vnode.attrs.close}>
				{/* NOSONAR S6848: this is a keyboard/pointer gesture-delegation layer for the
				    lightbox; the actual controls are the native <button> arrows within it. */}
				<div
					id="attachment-viewer"
					onkeydown={(event: KeyboardEvent) => this.onkeydown(vnode, event)}
					ondragstart={(event: DragEvent) => event.preventDefault()}
					onpointerdown={(event: PointerEvent) => this.onpointerdown(vnode, event)}
					onpointermove={(event: PointerEvent) => this.onpointermove(vnode, event)}
					onpointerup={(event: PointerEvent) => this.onpointerup(vnode, event)}
					onpointercancel={(event: PointerEvent) => this.onpointercancel(vnode, event)}>

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
							disabled={atStart}
							onclick={() => this.previous(vnode)}><i class="bi bi-chevron-left"></i></button>
					}

					<div class="attachment-stage">
						<div class="attachment-track" style={`transform:translateX(${-vnode.state.index * 100}%)`}>
							{attachments.map((attachment, index) => (
								<div key={attachment.url} class="attachment-slide">
									{this.drawAttachment(vnode, attachment, index)}
								</div>
							))}
						</div>
					</div>

					{hasMultiple &&
						<button
							type="button"
							class="attachment-nav attachment-next"
							aria-label="Next attachment"
							tabIndex="0"
							disabled={atEnd}
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
	// or download card that matches its kind. Media is mounted only for the current
	// slide (and never autoplays) so off-screen players do not load or play.
	drawAttachment(vnode: AttachmentsVnode, attachment: Attachment, index: number): JSX.Element {

		const isCurrent = (index == vnode.state.index)

		switch (attachmentKind(attachment)) {

			case "image":
				return <img src={attachment.url} class="attachment-media" alt={attachment.name} /> // NOSONAR: typescript:S6853

			case "video":
				return isCurrent
					? <video src={attachment.url} class="attachment-media" controls></video>
					: <div class="attachment-media-placeholder"><i class="bi bi-film"></i></div>

			case "audio":
				return (
					<div class="attachment-audio">
						<i class={"bi " + attachmentIcon(attachment)}></i>
						<div class="margin-bottom">{attachment.name || "Audio"}</div>
						{isCurrent && <audio src={attachment.url} controls></audio>}
					</div>
				)

			default:
				return (
					<a
						href={attachment.url}
						download={attachment.name || true}
						class="attachment-download"
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

	// goTo moves to the attachment at `index` (clamped; no wrapping) and pauses any
	// media that was playing on the slide being left behind.
	goTo(vnode: AttachmentsVnode, index: number) {

		const count = vnode.attrs.controller.modalAttachments.length
		const next = Math.max(0, Math.min(count - 1, index))

		if (next == vnode.state.index) {
			return
		}

		this.pauseAllMedia()
		vnode.state.index = next
	}

	// previous moves to the prior attachment.
	previous(vnode: AttachmentsVnode) {
		this.goTo(vnode, vnode.state.index - 1)
	}

	// next moves to the following attachment.
	next(vnode: AttachmentsVnode) {
		this.goTo(vnode, vnode.state.index + 1)
	}

	// pauseAllMedia pauses every <video>/<audio> in the lightbox, used before
	// navigating so a player never keeps running off-screen.
	pauseAllMedia() {
		document.querySelectorAll<HTMLMediaElement>("#attachment-viewer video, #attachment-viewer audio")
			.forEach(media => media.pause())
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

	// onpointerdown begins a drag gesture, recording its origin and whether it
	// started on an interactive media element.
	onpointerdown(vnode: AttachmentsVnode, event: PointerEvent) {

		// RULE: Only the primary (left) mouse button starts a drag
		if (event.pointerType == "mouse" && event.button != 0) {
			return
		}

		const onMedia = (event.target as HTMLElement | null)?.closest("video, audio, a, .attachment-download") != null

		vnode.state.drag = { startX: event.clientX, startY: event.clientY, onMedia, moved: false }
	}

	// onpointermove flags the gesture as a drag once it travels past DRAG_SLOP. A
	// drag that began on playing media pauses it (so a swipe over a video stops it),
	// while a stationary press is left alone for the native control to handle.
	onpointermove(vnode: AttachmentsVnode, event: PointerEvent) {

		const drag = vnode.state.drag
		if (drag == null || drag.moved) {
			return
		}

		if (Math.abs(event.clientX - drag.startX) < DRAG_SLOP && Math.abs(event.clientY - drag.startY) < DRAG_SLOP) {
			return
		}

		drag.moved = true

		// A horizontal drag that started on a playing video/audio pauses it
		if (drag.onMedia) {
			this.pauseAllMedia()
		}
	}

	// onpointerup completes the gesture, navigating when the horizontal travel
	// clears SWIPE_THRESHOLD and exceeds the vertical travel (so a vertical scroll
	// is not read as a swipe).
	onpointerup(vnode: AttachmentsVnode, event: PointerEvent) {

		const drag = vnode.state.drag
		vnode.state.drag = null

		if (drag == null) {
			return
		}

		const deltaX = event.clientX - drag.startX
		const deltaY = event.clientY - drag.startY

		// RULE: A swipe must be clearly horizontal and past the threshold
		if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
			return
		}

		if (deltaX > 0) {
			this.previous(vnode)
		} else {
			this.next(vnode)
		}

		m.redraw()
	}

	// onpointercancel abandons an in-progress gesture (e.g. the browser took over
	// for a scroll).
	onpointercancel(vnode: AttachmentsVnode, _event: PointerEvent) {
		vnode.state.drag = null
	}
}
