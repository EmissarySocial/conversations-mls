import m from "mithril"
import type { ViewController as Controller } from "./controller"
import { NewFilter, type Filter } from "../model/filter"
import { WidgetFilterEdit, STATE_OPTIONS } from "./widget-filter-edit"
import { haltEvent, synthClick } from "./utils"

type FiltersVnode = m.Vnode<FiltersArgs, FiltersState>

interface FiltersArgs {
	controller: Controller
}

interface FiltersState {
	editFilter?: Filter
	announcement: string

	// Drag state
	dragId?: string
	dropIndex?: number
	pointerY?: number
	listEl?: HTMLElement
	scrollContainer?: HTMLElement
	scrollDir?: number
	scrollRAF?: number
	moveHandler?: (event: PointerEvent) => void
	upHandler?: (event: PointerEvent) => void
	cancelHandler?: (event: PointerEvent) => void

	// Floating drag "ghost" copy
	grabOffsetY?: number
	ghostLeft?: number
	ghostWidth?: number
	ghostTop?: number

	// Keyboard focus follow
	focusFilterId?: string
}

// Pixels from the scroll container's edge that trigger auto-scroll while dragging
const AUTOSCROLL_EDGE = 48
const AUTOSCROLL_STEP = 8

// AppSettingsFilters renders the "Filters" settings tab, where the user can
// create, edit, delete, and reorder their conversation filters. Filters can be
// reordered by dragging the grip handle (mouse or touch) or, when a handle is
// focused, with the up/down arrow keys.
export class AppSettingsFilters {

	oninit(vnode: FiltersVnode) {
		vnode.state.announcement = ""
	}

	view(vnode: FiltersVnode) {

		const filters = vnode.attrs.controller.filters

		return (
			<div>
				<div class="text-lg bold margin-bottom">Filters</div>

				<div class="table filter-list">
					<div class="flex-row flex-align-center clickable link" role="button" tabIndex="0" onclick={() => this.addFilter(vnode)} onkeypress={synthClick}>
						<div class="flex-grow"><i class="bi bi-plus"></i> Add a Filter</div>
					</div>

					{this.viewRows(vnode, filters)}
				</div>

				<div class="visually-hidden" aria-live="polite">{vnode.state.announcement}</div>

				{this.viewGhost(vnode)}

				{vnode.state.editFilter &&
					<WidgetFilterEdit
						controller={vnode.attrs.controller}
						filter={vnode.state.editFilter}
						close={() => this.closeEdit(vnode)} />
				}
			</div>
		)
	}

	// viewRows renders the filter rows, interleaving the drop-indicator line at
	// the current drop position while dragging.
	viewRows(vnode: FiltersVnode, filters: Filter[]): m.Children {

		const dropIndex = (vnode.state.dragId == undefined) ? undefined : vnode.state.dropIndex
		const rows: m.Children[] = []

		filters.forEach((filter, index) => {
			if (dropIndex === index) {
				rows.push(<div key="__dropline__" class="filter-drop-line"></div>)
			}
			rows.push(this.viewRow(vnode, filters, filter))
		})

		if (dropIndex === filters.length) {
			rows.push(<div key="__dropline__" class="filter-drop-line"></div>)
		}

		return rows
	}

	// viewRow renders a single filter row. Locked filters are not editable, so the
	// row body is not rendered as a clickable link for them.
	viewRow(vnode: FiltersVnode, filters: Filter[], filter: Filter): m.Children {

		let cssClass = "flex-row flex-align-center filter-row"
		if (!filter.locked) {
			cssClass += " clickable"
		}
		if (vnode.state.dragId === filter.id) {
			cssClass += " dragging"
		}

		// Locked filters are not editable: render the row without link affordances.
		const linkAttrs = filter.locked
			? {}
			: { role: "button", tabIndex: "0", onclick: () => this.openEdit(vnode, filter), onkeypress: synthClick }

		return (
			<div key={filter.id} class={cssClass} {...linkAttrs}>
				<div
					class="filter-grip"
					role="button"
					tabIndex="0"
					aria-label={`Reorder ${filter.name}. Press up or down arrow to move.`}
					onpointerdown={(event: PointerEvent) => this.onGripDown(event, vnode, filter)}
					onkeydown={(event: KeyboardEvent) => this.onGripKey(event, vnode, filter)}
					onclick={(event: MouseEvent) => event.stopPropagation()}
					oncreate={(grip: m.VnodeDOM) => this.maybeFocus(grip, vnode, filter)}
					onupdate={(grip: m.VnodeDOM) => this.maybeFocus(grip, vnode, filter)}>
					<i class="bi bi-grip-vertical"></i>
				</div>
				<div class="flex-grow">
					<div class="bold">{filter.name}</div>
					<div class="text-sm text-gray">{this.summary(filter)}</div>
				</div>
				<div class="align-right">
					{(filters.length > 1) && !filter.locked &&
						<button type="button" class="text-xs" onclick={(event: MouseEvent) => this.deleteFilter(event, vnode, filter)}>Remove</button>
					}
				</div>
			</div>
		)
	}

	// viewGhost renders the floating copy of the row being dragged. It tracks the
	// cursor vertically and stays pinned to the row's horizontal position.
	viewGhost(vnode: FiltersVnode): m.Children {

		const filter = vnode.attrs.controller.filters.find((f) => f.id === vnode.state.dragId)
		if (filter == undefined) {
			return null
		}

		const style = `left:${vnode.state.ghostLeft ?? 0}px; width:${vnode.state.ghostWidth ?? 0}px; top:${vnode.state.ghostTop ?? 0}px;`

		return (
			<div class="filter-drag-ghost flex-row flex-align-center" style={style}>
				<div class="filter-grip"><i class="bi bi-grip-vertical"></i></div>
				<div class="flex-grow">
					<div class="bold">{filter.name}</div>
					<div class="text-sm text-gray">{this.summary(filter)}</div>
				</div>
			</div>
		)
	}

	// summary describes a filter's states and tags in a single line
	summary(filter: Filter): string {
		const states = filter.states.map((state) => STATE_OPTIONS.find((option) => option.state == state)?.label ?? state)
		const tags = filter.tags.map((tag) => "#" + tag)
		return [...states, ...tags].join(" · ")
	}

	/////////////////////////////////////////////
	// Pointer drag-and-drop
	/////////////////////////////////////////////

	// onGripDown begins a drag from the grip handle
	onGripDown(event: PointerEvent, vnode: FiltersVnode, filter: Filter) {

		// Only respond to the primary button (touch/pen report button 0)
		if (event.button !== 0) {
			return
		}

		event.preventDefault()
		event.stopPropagation()

		const grip = event.currentTarget as HTMLElement
		grip.setPointerCapture(event.pointerId)

		vnode.state.dragId = filter.id
		vnode.state.pointerY = event.clientY
		vnode.state.listEl = grip.closest(".filter-list") as HTMLElement
		vnode.state.scrollContainer = grip.closest(".scroll-vertical") as HTMLElement
		vnode.state.dropIndex = this.computeDropIndex(vnode, event.clientY)

		// Capture the dragged row's geometry for the floating ghost copy
		const rect = (grip.closest(".filter-row") as HTMLElement).getBoundingClientRect()
		vnode.state.grabOffsetY = event.clientY - rect.top
		vnode.state.ghostLeft = rect.left
		vnode.state.ghostWidth = rect.width
		vnode.state.ghostTop = rect.top

		// Show the "grabbing" cursor everywhere for the duration of the drag
		document.body.classList.add("filter-dragging")

		vnode.state.moveHandler = (e: PointerEvent) => this.onMove(e, vnode)
		vnode.state.upHandler = (e: PointerEvent) => this.onUp(e, vnode)
		vnode.state.cancelHandler = () => this.onCancel(vnode)
		document.addEventListener("pointermove", vnode.state.moveHandler)
		document.addEventListener("pointerup", vnode.state.upHandler)
		document.addEventListener("pointercancel", vnode.state.cancelHandler)
	}

	// onMove tracks the pointer and updates the drop position
	onMove(event: PointerEvent, vnode: FiltersVnode) {

		if (vnode.state.dragId == undefined) {
			return
		}

		event.preventDefault()
		vnode.state.pointerY = event.clientY
		vnode.state.ghostTop = event.clientY - (vnode.state.grabOffsetY ?? 0)
		vnode.state.dropIndex = this.computeDropIndex(vnode, event.clientY)
		this.updateAutoScroll(vnode)
		m.redraw()
	}

	// onUp commits the reorder and ends the drag
	onUp(_event: PointerEvent, vnode: FiltersVnode) {
		this.commitReorder(vnode)
		this.endDrag(vnode)
		m.redraw()
	}

	// onCancel ends the drag without committing
	onCancel(vnode: FiltersVnode) {
		this.endDrag(vnode)
		m.redraw()
	}

	// endDrag tears down all drag listeners and state
	endDrag(vnode: FiltersVnode) {

		if (vnode.state.moveHandler) {
			document.removeEventListener("pointermove", vnode.state.moveHandler)
		}
		if (vnode.state.upHandler) {
			document.removeEventListener("pointerup", vnode.state.upHandler)
		}
		if (vnode.state.cancelHandler) {
			document.removeEventListener("pointercancel", vnode.state.cancelHandler)
		}
		if (vnode.state.scrollRAF != undefined) {
			cancelAnimationFrame(vnode.state.scrollRAF)
		}

		delete vnode.state.moveHandler
		delete vnode.state.upHandler
		delete vnode.state.cancelHandler
		delete vnode.state.scrollRAF
		delete vnode.state.scrollDir
		delete vnode.state.dragId
		delete vnode.state.dropIndex
		delete vnode.state.pointerY
		delete vnode.state.listEl
		delete vnode.state.scrollContainer
		delete vnode.state.grabOffsetY
		delete vnode.state.ghostLeft
		delete vnode.state.ghostWidth
		delete vnode.state.ghostTop

		document.body.classList.remove("filter-dragging")
	}

	// commitReorder moves the dragged filter to the drop position and persists the new order
	commitReorder(vnode: FiltersVnode) {

		const dragId = vnode.state.dragId
		const dropIndex = vnode.state.dropIndex
		if (dragId == undefined || dropIndex == undefined) {
			return
		}

		const filters = vnode.attrs.controller.filters
		const from = filters.findIndex((f) => f.id === dragId)
		if (from < 0) {
			return
		}

		// Removing the dragged row shifts later indices down by one
		let to = dropIndex
		if (to > from) {
			to -= 1
		}
		if (to === from) {
			return
		}

		const moved = filters.splice(from, 1)[0]
		if (moved == undefined) {
			return
		}
		filters.splice(to, 0, moved)
		this.persistOrder(vnode)
		this.announce(vnode, `${moved.name} moved to position ${to + 1} of ${filters.length}`)
	}

	// computeDropIndex returns the filter index where the dragged row would land
	// for the given pointer Y position.
	computeDropIndex(vnode: FiltersVnode, clientY: number): number {

		const listEl = vnode.state.listEl
		if (listEl == undefined) {
			return vnode.attrs.controller.filters.length
		}

		const rows = listEl.querySelectorAll(".filter-row")
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i]
			if (row == undefined) {
				continue
			}
			const rect = row.getBoundingClientRect()
			if (clientY < rect.top + (rect.height / 2)) {
				return i
			}
		}
		return rows.length
	}

	/////////////////////////////////////////////
	// Auto-scroll while dragging near an edge
	/////////////////////////////////////////////

	// updateAutoScroll starts/stops the auto-scroll loop based on pointer position
	updateAutoScroll(vnode: FiltersVnode) {

		const container = vnode.state.scrollContainer
		if (container == undefined) {
			return
		}

		const rect = container.getBoundingClientRect()
		const y = vnode.state.pointerY ?? 0

		let dir = 0
		if (y < rect.top + AUTOSCROLL_EDGE) {
			dir = -1
		} else if (y > rect.bottom - AUTOSCROLL_EDGE) {
			dir = 1
		}

		vnode.state.scrollDir = dir

		// Start the loop if we just entered an edge zone
		if (dir !== 0 && vnode.state.scrollRAF == undefined) {
			this.autoScrollTick(vnode)
		}
	}

	// autoScrollTick scrolls the container and re-evaluates the drop position each frame
	autoScrollTick(vnode: FiltersVnode) {

		const container = vnode.state.scrollContainer
		const dir = vnode.state.scrollDir ?? 0

		if (container == undefined || dir === 0 || vnode.state.dragId == undefined) {
			delete vnode.state.scrollRAF
			return
		}

		container.scrollTop += dir * AUTOSCROLL_STEP
		vnode.state.dropIndex = this.computeDropIndex(vnode, vnode.state.pointerY ?? 0)
		m.redraw()

		vnode.state.scrollRAF = requestAnimationFrame(() => this.autoScrollTick(vnode))
	}

	/////////////////////////////////////////////
	// Keyboard reordering
	/////////////////////////////////////////////

	// onGripKey moves the filter up/down when the handle is focused
	onGripKey(event: KeyboardEvent, vnode: FiltersVnode, filter: Filter) {

		if (event.key === "ArrowUp") {
			event.preventDefault()
			this.moveByKeyboard(vnode, filter, -1)
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			this.moveByKeyboard(vnode, filter, 1)
		}
	}

	// moveByKeyboard moves the filter one slot in the given direction and persists the order
	moveByKeyboard(vnode: FiltersVnode, filter: Filter, direction: number) {

		const filters = vnode.attrs.controller.filters
		const from = filters.findIndex((f) => f.id === filter.id)
		const to = from + direction

		if (to < 0 || to >= filters.length) {
			return
		}

		const moved = filters.splice(from, 1)[0]
		if (moved == undefined) {
			return
		}
		filters.splice(to, 0, moved)
		this.persistOrder(vnode)
		this.announce(vnode, `${moved.name} moved to position ${to + 1} of ${filters.length}`)

		// Keep focus on the moved filter's handle after the redraw
		vnode.state.focusFilterId = filter.id
	}

	// maybeFocus restores focus to a grip handle after a keyboard move
	maybeFocus(grip: m.VnodeDOM, vnode: FiltersVnode, filter: Filter) {
		if (vnode.state.focusFilterId === filter.id) {
			(grip.dom as HTMLElement).focus()
			delete vnode.state.focusFilterId
		}
	}

	/////////////////////////////////////////////
	// Shared helpers
	/////////////////////////////////////////////

	// persistOrder renumbers every filter's sort field (contiguous 1..N) and saves it
	persistOrder(vnode: FiltersVnode) {
		const filters = vnode.attrs.controller.filters
		filters.forEach((filter, index) => {
			filter.sort = index + 1
			vnode.attrs.controller.saveFilter(filter)
		})
	}

	// announce updates the aria-live region for screen readers
	announce(vnode: FiltersVnode, message: string) {
		vnode.state.announcement = message
	}

	/////////////////////////////////////////////
	// Add / edit / delete
	/////////////////////////////////////////////

	// addFilter opens the edit dialog for a brand-new filter, appended at the bottom
	addFilter(vnode: FiltersVnode) {
		const filters = vnode.attrs.controller.filters
		const filter = NewFilter()
		filter.sort = (filters.length > 0) ? Math.max(...filters.map((f) => f.sort)) + 1 : 1
		vnode.state.editFilter = filter
	}

	// openEdit opens the edit dialog for an existing filter
	openEdit(vnode: FiltersVnode, filter: Filter) {

		// RULE: locked (built-in) filters cannot be edited
		if (filter.locked) {
			throw new Error("Cannot edit a locked filter")
		}

		vnode.state.editFilter = filter
	}

	// deleteFilter removes a filter after confirmation
	deleteFilter(event: MouseEvent, vnode: FiltersVnode, filter: Filter) {

		// Don't let the click bubble up and open the edit dialog
		haltEvent(event)

		// RULE: never remove the last remaining filter
		if (vnode.attrs.controller.filters.length <= 1) {
			return
		}

		if (!confirm(`Delete the filter "${filter.name}"?`)) {
			return
		}

		vnode.attrs.controller.deleteFilter(filter.id)
	}

	// closeEdit dismisses the edit dialog
	closeEdit(vnode: FiltersVnode) {
		delete vnode.state.editFilter
	}
}
