// NARROW_BREAKPOINT is the single source of truth for the list/detail collapse.
// Below this width the app runs in "mobile" mode: one pane at a time (the
// conversation/settings list OR a detail), chosen in Mithril (Index / AppSettings),
// and the `.is-mobile` class on the SPA root scopes the small-screen CSS.
export const NARROW_BREAKPOINT = 768

// #isMobile is decided ONCE, at startup. We deliberately do not track live resizes:
// the responsive behavior targets actual phones (which don't resize across the
// breakpoint), so a one-shot decision keeps the layout logic simple and avoids the
// fragile redraw-on-resize path. Defaults to false until initResponsive runs.
let mobile = false

// isNarrow reports whether the app is in mobile (single-pane) mode.
export function isNarrow(): boolean {
	return mobile
}

let installed = false

// initResponsive decides mobile mode once (innerWidth < breakpoint) and tags the SPA
// root (#mls) with `.is-mobile` so CSS can scope small-screen rules to it. Safe to
// call more than once.
export function initResponsive() {

	if (installed) {
		return
	}
	installed = true

	mobile = globalThis.innerWidth < NARROW_BREAKPOINT

	if (mobile) {
		document.getElementById("mls")?.classList.add("is-mobile")
	}
}
