import m, { type Vnode } from "mithril"

type ToggleVnode = Vnode<ToggleArgs, ToggleState>

interface ToggleArgs {
	// value is the current on/off state (controlled by the parent).
	value: boolean

	// onchange is called with the requested next value when the user activates
	// the toggle. The parent is responsible for updating `value`.
	onchange: (next: boolean) => void

	// trueText/falseText are the labels shown when the toggle is on/off.
	// (Omit both for a label-less toggle, or to fall back to `text`.)
	trueText?: string
	falseText?: string

	// text is a fixed label shown in both states. It is used only when the
	// state-specific label (trueText/falseText) is empty, mirroring the `text`
	// override on the _hyperscript toggle behavior.
	text?: string

	// disabled greys out the control and ignores activation.
	disabled?: boolean
}

interface ToggleState { }

// Toggle is a Mithril port of Emissary's _hyperscript "toggle" behavior: a sliding
// on/off switch that reuses the global .toggle-container / .toggle / .marker styles
// (see theme-global/02-forms.css), so it renders identically to the server-rendered
// toggles. It is a controlled widget — the parent owns the boolean and supplies
// `onchange`. The label text swaps between trueText and falseText with the state.
//
// Accessibility mirrors the inclusive-toggle pattern the _hyperscript version uses:
// role="switch", aria-checked, keyboard focus, and Space/Enter activation.
export class Toggle {

	view(vnode: ToggleVnode): m.Children {

		const { value, trueText, falseText, text, disabled } = vnode.attrs

		// Prefer the state-specific label; fall back to the fixed `text` when it's empty.
		const stateText = value ? trueText : falseText
		const label = (stateText != undefined && stateText != "") ? stateText : text

		return (
			<span
				class="toggle-container"
				role="switch"
				tabIndex={disabled ? -1 : 0}
				aria-checked={value ? "true" : "false"}
				aria-disabled={disabled ? "true" : "false"}
				value={value ? "true" : "false"}
				onclick={() => this.activate(vnode)}
				onkeydown={(event: KeyboardEvent) => this.onKeydown(vnode, event)}>
				<span class="toggle"><span class="marker"></span></span>
				{(label != undefined) && <label>{label}</label>}
			</span>
		)
	}

	// activate requests the opposite of the current value (unless disabled).
	activate(vnode: ToggleVnode) {
		if (vnode.attrs.disabled) {
			return
		}
		vnode.attrs.onchange(!vnode.attrs.value)
	}

	// onKeydown activates the toggle on Space or Enter, matching native switch
	// keyboard behavior (the _hyperscript version listens for Space).
	onKeydown(vnode: ToggleVnode, event: KeyboardEvent) {
		if (event.key != " " && event.key != "Enter") {
			return
		}
		event.preventDefault()
		this.activate(vnode)
	}
}
