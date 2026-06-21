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
	// suppressClick is true immediately after a drag, so the trailing click event
	// (e.g. on a download link or the underlay) is swallowed rather than acted on.
	suppressClick: boolean
}

// DragAxis is locked on the first significant movement of a gesture: "x" enables
// horizontal swiping, "y" makes the gesture inert (vertical drags do nothing).
type DragAxis = "" | "x" | "y"

// DragState tracks a pointer gesture from press to release across the stage.
interface DragState {
	pointerId: number
	startX: number
	startY: number
	// axis is locked to "x" or "y" once the gesture clears DRAG_SLOP.
	axis: DragAxis
}

// Attachments is the full-screen attachment lightbox. It shows the attachments as
// a sliding track and lets the user move between them with the on-screen arrows,
// the keyboard, or a mouse/touch swipe. Navigation does not wrap.
export class Attachments {

	oninit(vnode: AttachmentsVnode) {
		vnode.state.index = vnode.attrs.controller.modalAttachmentIndex
		vnode.state.drag = null
		vnode.state.suppressClick = false
	}

	// clickSuppressor swallows the synthetic click that a browser fires right after a
	// drag, so a drag that ends over a link/button does not also activate it. Held as
	// a field so it can be removed on teardown.
	clickSuppressor = (event: MouseEvent) => {
		if (this.#state?.suppressClick) {
			event.stopPropagation()
			event.preventDefault()
			this.#state.suppressClick = false
		}
	}

	// #state is a reference to the vnode state, captured so the capture-phase click
	// listener (added imperatively) can read the suppressClick flag.
	#state: AttachmentsState | null = null

	oncreate(vnode: AttachmentsVnode) {
		// The lightbox uses the global "huge" modal size for maximum viewing area
		document.getElementById("modal-window")?.classList.add("huge")

		// Suppress the post-drag click in the capture phase, before it reaches links
		this.#state = vnode.state
		document.getElementById("attachment-viewer")?.addEventListener("click", this.clickSuppressor, true)
	}

	onremove() {
		document.getElementById("attachment-viewer")?.removeEventListener("click", this.clickSuppressor, true)
		this.#state = null
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
				return (
					<div class="attachment-frame">
						<img src={attachment.url} class="attachment-media" alt={attachment.name} /> {/* NOSONAR: typescript:S6853 */}
						{this.drawDownloadButton(attachment, "attachment-download-overlay")}
					</div>
				)

			case "video":
				return isCurrent
					? (
						<div class="attachment-frame">
							<video src={attachment.url} class="attachment-media" controls></video>
							{this.drawDownloadButton(attachment, "attachment-download-corner")}
						</div>
					)
					: <div class="attachment-media-placeholder"><i class="bi bi-film"></i></div>

			case "audio":
				return (
					<div class="attachment-audio">
						<i class={"bi " + attachmentIcon(attachment)}></i>
						<div class="margin-bottom">{attachment.name || "Audio"}</div>
						{isCurrent && <audio src={attachment.url} controls></audio>}
						{this.drawDownloadButton(attachment, "margin-top")}
					</div>
				)

			default:
				return (
					<div class="attachment-download">
						<i class={"bi " + attachmentIcon(attachment)}></i>
						<div class="bold">{attachment.name || "Download File"}</div>
						{(attachment.size > 0) && <div class="text-sm text-gray">{formatFileSize(attachment.size)}</div>}
						{this.drawDownloadButton(attachment, "margin-top")}
					</div>
				)
		}
	}

	// drawDownloadButton renders the "Download" link for an attachment. `extraClass`
	// positions it for the surrounding layout (e.g. an overlay on an image, a corner
	// badge on a video, or a plain button below an audio/file card).
	drawDownloadButton(attachment: Attachment, extraClass: string): JSX.Element {
		return (
			<a
				href={attachment.url}
				download={attachment.name || true}
				class={"button " + extraClass}
				target="_blank"
				rel="noopener noreferrer"><i class="bi bi-download"></i> Download</a>
		)
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

	// track returns the sliding element that holds all the slides.
	track(): HTMLElement | null {
		return document.querySelector("#attachment-viewer .attachment-track")
	}

	// setTrackOffset writes the track transform imperatively during a drag so it
	// follows the pointer at the browser's native frame rate, bypassing redraw.
	// offsetPx is the live finger travel added to the resting position.
	setTrackOffset(vnode: AttachmentsVnode, offsetPx: number) {
		const track = this.track()
		if (track != null) {
			track.style.transform = `translateX(calc(${-vnode.state.index * 100}% + ${offsetPx}px))`
		}
	}

	// restTrackOffset snaps the inline transform to the resting position for the
	// current index (offset 0). Setting it explicitly — rather than clearing the
	// inline style and waiting for the redraw — avoids a one-frame jump to
	// translateX(0) (the first slide), which otherwise animates in as a false
	// "wrap to the beginning".
	restTrackOffset(vnode: AttachmentsVnode) {
		this.setTrackOffset(vnode, 0)
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

	// onpointerdown begins a drag gesture, recording its origin and the stage width.
	// Gestures that start on a media control or link are ignored so the native
	// control (e.g. a video scrubber) keeps the pointer.
	onpointerdown(vnode: AttachmentsVnode, event: PointerEvent) {

		// RULE: Only the primary (left) mouse button starts a drag
		if (event.pointerType == "mouse" && event.button != 0) {
			return
		}

		// RULE: Drags starting on media controls or links are scrubbing/clicks, not swipes
		if ((event.target as HTMLElement | null)?.closest("video, audio, a, button") != null) {
			return
		}

		vnode.state.drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			axis: "",
		}
	}

	// onpointermove locks the gesture's axis on first significant movement, then —
	// for a horizontal drag — moves the track with the pointer in real time (hard
	// stopped at the first/last item). Vertical drags are inert.
	onpointermove(vnode: AttachmentsVnode, event: PointerEvent) {

		const drag = vnode.state.drag
		if (drag == null) {
			return
		}

		const deltaX = event.clientX - drag.startX
		const deltaY = event.clientY - drag.startY

		// Lock the axis once the gesture clears the slop radius
		if (drag.axis == "") {
			this.lockAxis(drag, deltaX, deltaY, event.currentTarget as HTMLElement)
		}

		// RULE: Vertical drags (and not-yet-locked gestures) do nothing
		if (drag.axis != "x") {
			return
		}

		this.setTrackOffset(vnode, this.clampOffset(vnode, deltaX))
	}

	// lockAxis decides whether a gesture is a horizontal swipe or a vertical (inert)
	// drag once it clears the slop radius. On locking horizontal it captures the
	// pointer and disables the snap transition so the track follows the pointer.
	lockAxis(drag: DragState, deltaX: number, deltaY: number, target: HTMLElement) {

		if (Math.abs(deltaX) < DRAG_SLOP && Math.abs(deltaY) < DRAG_SLOP) {
			return
		}

		drag.axis = (Math.abs(deltaX) > Math.abs(deltaY)) ? "x" : "y"

		if (drag.axis == "x") {
			this.track()?.classList.add("dragging")
			try {
				target.setPointerCapture(drag.pointerId)
			} catch { /* capture is best-effort */ }
		}
	}

	// clampOffset applies the hard stop: a drag cannot pull the track past the first
	// or last item, so over-dragging at an edge produces no movement.
	clampOffset(vnode: AttachmentsVnode, deltaX: number): number {

		const count = vnode.attrs.controller.modalAttachments.length
		const atStart = vnode.state.index <= 0
		const atEnd = vnode.state.index >= count - 1

		if ((deltaX > 0 && atStart) || (deltaX < 0 && atEnd)) {
			return 0
		}

		return deltaX
	}

	// onpointerup completes the gesture: a horizontal drag past SWIPE_THRESHOLD
	// commits to the neighbor, otherwise it snaps back. The trailing click is
	// suppressed so a drag that ends over a link does not also activate it.
	onpointerup(vnode: AttachmentsVnode, event: PointerEvent) {

		const drag = vnode.state.drag
		vnode.state.drag = null

		if (drag?.axis != "x") {
			return
		}

		const deltaX = event.clientX - drag.startX

		// A real drag swallows the synthetic click that follows it
		vnode.state.suppressClick = true

		// RULE: Commit only on a clear horizontal swipe past the threshold (goTo
		// clamps, so a swipe past the first/last item simply stays put).
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			if (deltaX > 0) {
				this.previous(vnode)
			} else {
				this.next(vnode)
			}
		}

		// Re-enable the transition and snap the inline transform to the (possibly new)
		// resting index. Setting the resting offset explicitly — and leaving it in
		// place — avoids a flash at translateX(0) that would animate in as a false
		// wrap to the first slide. A later redraw from arrow/key navigation rewrites
		// the transform for the new index, so the inline value never goes stale.
		this.track()?.classList.remove("dragging")
		this.restTrackOffset(vnode)
		m.redraw()
	}

	// onpointercancel abandons an in-progress gesture (e.g. the browser took over
	// for a scroll), snapping the track back to rest.
	onpointercancel(vnode: AttachmentsVnode, _event: PointerEvent) {

		if (vnode.state.drag == null) {
			return
		}

		vnode.state.drag = null
		this.track()?.classList.remove("dragging")
		this.restTrackOffset(vnode)
		m.redraw()
	}
}
