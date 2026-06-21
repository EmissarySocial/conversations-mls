import m, { type Vnode } from "mithril"
import { Actor } from "../as/actor"
import type { ViewController } from "./controller"

// MentionPopupController is the imperative handle a host (e.g. a message composer)
// uses to drive the popup's keyboard navigation while focus stays in its own text
// field. The host forwards arrow/enter/escape keys to these methods and uses
// `isActive` to decide whether to intercept those keys at all.
export interface MentionPopupController {
	// isActive reports whether the popup currently has results to navigate.
	isActive(): boolean
	// moveHighlight changes the highlighted result by `delta` (e.g. -1 / +1).
	moveHighlight(delta: number): void
	// selectHighlighted commits the highlighted result (returns true if one was committed).
	selectHighlighted(): boolean
}

type MentionPopupVnode = Vnode<MentionPopupArgs, MentionPopupState>

interface MentionPopupArgs {
	controller: ViewController

	// query is the text typed after the "@" (without the "@"). The popup searches
	// whenever this changes. An empty query clears the results.
	query: string

	// left is the viewport x-coordinate of the caret. bottom is the distance from
	// the viewport's bottom edge to the caret line; the popup's bottom edge is
	// pinned there and the list grows upward, so it opens ABOVE the caret (the
	// composer sits at the bottom of the screen, where a downward popup would be
	// clipped).
	left: number
	bottom: number

	// onselect is called with a fully-qualified "@user@host" handle when the user
	// picks a result. The host splices this into its text field.
	onselect: (handle: string) => void

	// onready hands the host an imperative controller for keyboard navigation. It is
	// called once, after the popup mounts.
	onready?: (controller: MentionPopupController) => void
}

interface MentionPopupState {
	actors: Actor[]
	highlighted: number
	// requestSeq guards against out-of-order async responses: only the most recent
	// request is allowed to apply its results.
	requestSeq: number
	lastQuery: string
	// searchTimeout is the pending debounce timer for the next server request.
	searchTimeout?: ReturnType<typeof setTimeout>
}

// The actor search endpoint (shared with the actor-search widget).
const ACTOR_SEARCH_ENDPOINT = "/.api/actors"

// Debounce window (ms) before a typed query hits the server. 150ms stays below the
// ~200ms perceptible-lag threshold (results feel instant) while coalescing fast
// typing into a single request.
const SEARCH_DEBOUNCE_MS = 150

// MentionPopup is a caret-anchored autocomplete list for @mentions. It searches
// the server's actor directory by the typed query and renders a keyboard- and
// mouse-navigable menu. It owns its search and selection state; the host owns the
// text field and decides when the popup is shown (by mounting it) and where (via
// left/top). Selection returns a ready-to-insert "@user@host" handle.
export class MentionPopup implements MentionPopupController {

	// The current vnode, captured so the imperative MentionPopupController methods
	// (called by the host) can reach both state and attrs.
	private vnode!: MentionPopupVnode

	oninit(vnode: MentionPopupVnode) {
		this.vnode = vnode
		vnode.state.actors = []
		vnode.state.highlighted = 0
		vnode.state.requestSeq = 0
		vnode.state.lastQuery = ""
		this.scheduleSearch(vnode, vnode.attrs.query)
	}

	oncreate(vnode: MentionPopupVnode) {
		vnode.attrs.onready?.(this)
	}

	onremove(vnode: MentionPopupVnode) {
		this.clearPendingSearch(vnode)
	}

	// onupdate keeps the captured vnode current (attrs/query change across redraws)
	// and re-runs the search whenever the query changes.
	onupdate(vnode: MentionPopupVnode) {
		this.vnode = vnode
		if (vnode.attrs.query !== vnode.state.lastQuery) {
			this.scheduleSearch(vnode, vnode.attrs.query)
		}
	}

	view(vnode: MentionPopupVnode) {

		// The popup is shown whenever a mention is in progress — even before any
		// results arrive — so it renders an empty card on first open rather than
		// nothing. (Keyboard nav stays gated on isActive(), so an empty popup simply
		// lets navigation keys fall through to the text field.)

		// Pin the bottom edge just above the caret line and let the list grow upward.
		const style = `position:fixed; left:${vnode.attrs.left}px; bottom:${vnode.attrs.bottom}px; z-index:200;`

		return (
			<div class="popup mention-popup" role="menu" style={style}>
				{vnode.state.actors.map((actor, index) => (
					<div
						key={actor.id()}
						role="menuitem"
						tabIndex="-1"
						class={"popup-menu-item padding-xs" + (index == vnode.state.highlighted ? " highlight" : "")}
						onmousedown={(event: MouseEvent) => this.onItemMousedown(vnode, index, event)}
						aria-selected={index == vnode.state.highlighted ? "true" : null}>
						<div class="width-32 flex-shrink-0" aria-hidden="true">
							<img src={actor.icon()} alt="" class="width-32 circle" />
						</div>
						<div class="margin-left-xs">
							<div class="bold">{actor.name()}</div>
							<div class="margin-none text-xs text-light-gray">{actor.computedUsername()}</div>
						</div>
					</div>
				))}
			</div>
		)
	}

	// onItemMousedown selects a result. mousedown (not click) fires before the text
	// field loses focus, so the host's blur handling does not race the selection.
	onItemMousedown(vnode: MentionPopupVnode, index: number, event: MouseEvent) {
		event.preventDefault()
		vnode.state.highlighted = index
		this.commit(vnode)
	}

	// scheduleSearch debounces the server search. An empty query clears results
	// immediately (dismissal should feel instant); a non-empty query fires after a
	// short quiet period so fast typing coalesces into one request.
	scheduleSearch(vnode: MentionPopupVnode, query: string) {

		vnode.state.lastQuery = query
		this.clearPendingSearch(vnode)

		if (query == "") {
			vnode.state.actors = []
			vnode.state.highlighted = 0
			return
		}

		vnode.state.searchTimeout = setTimeout(() => {
			delete vnode.state.searchTimeout
			this.runSearch(vnode, query)
		}, SEARCH_DEBOUNCE_MS)
	}

	// clearPendingSearch cancels any debounce timer awaiting a server request.
	clearPendingSearch(vnode: MentionPopupVnode) {
		if (vnode.state.searchTimeout != undefined) {
			clearTimeout(vnode.state.searchTimeout)
			delete vnode.state.searchTimeout
		}
	}

	// runSearch queries the actor directory for `query`, ignoring stale responses.
	async runSearch(vnode: MentionPopupVnode, query: string) {

		const seq = ++vnode.state.requestSeq

		try {
			const results: object[] = await m.request(ACTOR_SEARCH_ENDPOINT + "?q=" + encodeURIComponent(query))

			// Drop the response if a newer request has since been issued.
			if (seq != vnode.state.requestSeq) {
				return
			}

			vnode.state.actors = results.map(object => new Actor(object))
			vnode.state.highlighted = 0
		} catch (error) {
			if ((error as { code?: number }).code === 401) {
				vnode.attrs.controller.stop("SESSION-EXPIRED")
				return
			}
			console.error("MentionPopup: error searching actors:", error)
			if (seq == vnode.state.requestSeq) {
				vnode.state.actors = []
			}
		} finally {
			m.redraw()
		}
	}

	// commit fires onselect with the highlighted actor's "@user@host" handle.
	private commit(vnode: MentionPopupVnode) {
		const actor = vnode.state.actors[vnode.state.highlighted]
		if (actor == undefined) {
			return
		}
		vnode.attrs.onselect(actor.computedUsername())
	}

	//////////////////////////////////////////
	// MentionPopupController (imperative handle for the host)

	isActive(): boolean {
		return this.vnode.state.actors.length > 0
	}

	moveHighlight(delta: number): void {
		const count = this.vnode.state.actors.length
		if (count == 0) {
			return
		}
		// Wrap around the ends so the list cycles.
		this.vnode.state.highlighted = (this.vnode.state.highlighted + delta + count) % count
		m.redraw()
	}

	selectHighlighted(): boolean {
		if (this.vnode.state.actors[this.vnode.state.highlighted] == undefined) {
			return false
		}
		this.commit(this.vnode)
		return true
	}
}
