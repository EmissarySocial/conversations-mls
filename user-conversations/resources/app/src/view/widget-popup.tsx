import m from "mithril"

type PopupVnode = m.Vnode<PopupArgs, PopupState>
type PopupVnodeDOM = m.VnodeDOM<PopupArgs, PopupState>

// PopupAlign controls how the popup card is positioned horizontally relative to
// its trigger: centered under it (the default), or pinned to the trigger's left
// or right edge (so a far-edge trigger doesn't push the card off-screen).
type PopupAlign = "center" | "left" | "right"

interface PopupArgs {
	// trigger renders the element that toggles the popup. It receives a toggle
	// callback and the current open state.
	trigger: (toggle: () => void, isOpen: boolean) => m.Children
	// content renders the popup body. It receives a close callback so the body
	// can dismiss the popup (e.g. after the user makes a selection).
	content: (close: () => void) => m.Children
	// align positions the card horizontally relative to the trigger. Defaults to
	// "center".
	align?: PopupAlign
}

interface PopupState {
	isOpen: boolean
	anchor?: HTMLElement
	docClickHandler?: (event: MouseEvent) => void
	keyHandler?: (event: KeyboardEvent) => void
}

// Popup is a reusable pop-up. It renders a trigger element and positions its
// content in an anchored card (with a caret) below the trigger, managing its own
// open/closed state. It dismisses on selection, outside-click, and Escape.
export class Popup {

	oninit(vnode: PopupVnode) {
		vnode.state.isOpen = false
	}

	oncreate(vnode: PopupVnodeDOM) {
		vnode.state.anchor = vnode.dom as HTMLElement
	}

	onremove(vnode: PopupVnode) {
		this.detach(vnode)
	}

	view(vnode: PopupVnode) {
		const alignClass = "popup-align-" + (vnode.attrs.align ?? "center")
		return (
			<div class="popup-anchor">
				{vnode.attrs.trigger(() => this.toggle(vnode), vnode.state.isOpen)}
				{vnode.state.isOpen &&
					<div class={"popup popup-below " + alignClass}>
						<div class="popup-caret"></div>
						{vnode.attrs.content(() => this.close(vnode))}
					</div>
				}
			</div>
		)
	}

	toggle(vnode: PopupVnode) {
		if (vnode.state.isOpen) {
			this.close(vnode)
		} else {
			this.open(vnode)
		}
	}

	// open shows the popup and wires up the dismissal listeners
	open(vnode: PopupVnode) {

		vnode.state.isOpen = true

		// Close when the user clicks outside the popup (and its trigger)
		const docClickHandler = (event: MouseEvent) => {
			if (vnode.state.anchor?.contains(event.target as Node)) {
				return
			}
			this.close(vnode)
		}

		// Close on Escape
		const keyHandler = (event: KeyboardEvent) => {
			if (event.key == "Escape") {
				this.close(vnode)
			}
		}

		vnode.state.docClickHandler = docClickHandler
		vnode.state.keyHandler = keyHandler

		// Attach on the next tick so the opening click doesn't immediately close it
		setTimeout(() => {
			document.addEventListener("click", docClickHandler)
			document.addEventListener("keydown", keyHandler)
		}, 0)
	}

	// close hides the popup and removes the dismissal listeners
	close(vnode: PopupVnode) {
		vnode.state.isOpen = false
		this.detach(vnode)
		m.redraw()
	}

	// detach removes any document listeners attached for the popup
	detach(vnode: PopupVnode) {

		if (vnode.state.docClickHandler) {
			document.removeEventListener("click", vnode.state.docClickHandler)
			delete vnode.state.docClickHandler
		}

		if (vnode.state.keyHandler) {
			document.removeEventListener("keydown", vnode.state.keyHandler)
			delete vnode.state.keyHandler
		}
	}
}
