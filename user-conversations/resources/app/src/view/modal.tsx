import m, { type VnodeDOM } from "mithril"
import { keyCode, getFocusElements } from "./utils"

interface ModalAttrs {
	close: () => void
}

type ModalVnode = VnodeDOM<ModalAttrs, {}>

// Adapted from: https://mithril-by-examples.js.org/examples/modal-2/#modal.js
export class Modal {

	// onEscape closes the modal when Escape is pressed. It is bound globally (not to
	// the modal element) so it fires even when focus has left the modal — e.g. after
	// clicking the underlay, or when the modal has no focusable element.
	readonly #onEscape = (event: KeyboardEvent) => {
		if (keyCode(event) == "Escape") {
			this.#close()
		}
	}

	// #close is the current modal's close callback, captured so the document-level
	// Escape handler can reach it.
	#close: () => void = () => { }

	oncreate(vnode: ModalVnode) {

		this.#close = vnode.attrs.close
		globalThis.addEventListener("keydown", this.#onEscape)

		requestAnimationFrame(() => {
			document.getElementById("modal")?.classList.add("ready")

			const firstElement = vnode.dom.querySelector("[tabIndex]") as HTMLInputElement
			firstElement?.focus()

			m.redraw()
		})
	}

	onremove() {
		globalThis.removeEventListener("keydown", this.#onEscape)
	}

	view(vnode: ModalVnode) {
		return (
			<div id="modal" onkeydown={(event: KeyboardEvent) => this.onkeydown(event, vnode)}> {/* NOSONAR: This is for visible pop-ups only. Keyboard accessibility is handled separately. */}
				<div id="modal-underlay" onclick={vnode.attrs.close}>{/* NOSONAR */}</div>
				<div id="modal-window">{vnode.children}</div>
			</div>
		)
	}

	onkeydown(event: KeyboardEvent, vnode: ModalVnode) {
		switch (keyCode(event)) {

			// Trap tab focus
			case "Tab": {
				const [firstElement, lastElement] = getFocusElements(vnode.dom)

				if (document.activeElement == lastElement) {
					firstElement?.focus()
					event.stopPropagation()
					event.preventDefault()
				}
				return
			}

			// Trap tab focus
			case "Shift+Tab": {
				const [firstElement, lastElement] = getFocusElements(vnode.dom)

				if (document.activeElement == firstElement) {
					lastElement?.focus()
					event.stopPropagation()
					event.preventDefault()
				}
				return
			}
		}
	}
}
