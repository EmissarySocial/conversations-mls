import m, { type Vnode } from "mithril"
import { ViewController } from "./controller"
import type { Filter } from "../model/filter"
import type { GroupState } from "../model/group"
import { Modal } from "./modal"
import { haltEvent } from "./utils"

type FilterEditVnode = Vnode<FilterEditAttrs, FilterEditState>

interface FilterEditAttrs {
	controller: ViewController
	filter: Filter
	close: () => void
}

interface FilterEditState {
	name: string
	states: GroupState[]
	tags: string
}

// STATE_OPTIONS are the conversation states a filter can include.
export const STATE_OPTIONS: { state: GroupState, label: string }[] = [
	{ state: "IMPORTANT", label: "Important" },
	{ state: "ACTIVE", label: "Current" },
	{ state: "ARCHIVED", label: "Archived" },
]

// WidgetFilterEdit is a modal dialog for creating or editing a conversation filter.
export class WidgetFilterEdit {

	oninit(vnode: FilterEditVnode) {
		const filter = vnode.attrs.filter
		vnode.state.name = filter.name
		vnode.state.states = [...filter.states]
		vnode.state.tags = filter.tags.map((tag) => "#" + tag).join(" ")
	}

	view(vnode: FilterEditVnode) {

		// The filter is "new" until it has been saved into the controller's list
		const isNew = !vnode.attrs.controller.filters.some((f) => f.id == vnode.attrs.filter.id)

		return (
			<Modal close={vnode.attrs.close}>
				<form onsubmit={(event: SubmitEvent) => this.save(event, vnode)}>
					<div class="layout layout-vertical">
						<div class="layout-title">
							{isNew ? <span><i class="bi bi-plus"></i> Add a Filter</span> : <span><i class="bi bi-pencil"></i> Edit Filter</span>}
						</div>
						<div class="layout-elements">

							<div class="layout-element">
								<label for="filterName">Filter Name</label> {/* NOSONAR: "for" works fine in Mithril */}
								<input id="filterName" type="text" tabIndex="0" value={vnode.state.name} oninput={(event: Event) => this.setName(vnode, event)} />
							</div>

							<div class="layout-element">
								<label for="filterTags">Tags</label> {/* NOSONAR: "for" works fine in Mithril */}
								<input id="filterTags" type="text" placeholder="#add #hashtags #here" value={vnode.state.tags} oninput={(event: Event) => this.setTags(vnode, event)} />
							</div>

							<div class="layout-element">
								<label>State(s)</label> {/* NOSONAR: this label groups the checkboxes below */}
								{STATE_OPTIONS.map((option) => (
									<label key={option.state} for={"state-" + option.state}> {/* NOSONAR: "for" works fine in Mithril */}
										<input
											id={"state-" + option.state}
											type="checkbox"
											checked={vnode.state.states.includes(option.state)}
											onchange={() => this.toggleState(vnode, option.state)} />
										<span>{option.label}</span>
									</label>
								))}
							</div>

						</div>
					</div>
					<div class="margin-top">
						<button type="submit" class="primary" tabIndex="0">Save Changes</button>
						<button type="button" onclick={vnode.attrs.close} tabIndex="0">Cancel</button>
					</div>
				</form>
			</Modal>
		)
	}

	setName(vnode: FilterEditVnode, event: Event) {
		vnode.state.name = (event.target as HTMLInputElement).value
	}

	toggleState(vnode: FilterEditVnode, state: GroupState) {
		if (vnode.state.states.includes(state)) {
			vnode.state.states = vnode.state.states.filter((s) => s != state)
		} else {
			vnode.state.states = [...vnode.state.states, state]
		}
	}

	setTags(vnode: FilterEditVnode, event: Event) {
		vnode.state.tags = (event.target as HTMLInputElement).value
	}

	async save(event: SubmitEvent, vnode: FilterEditVnode) {

		// Prevent the form submit from reloading the page
		haltEvent(event)

		const filter = vnode.attrs.filter
		filter.name = vnode.state.name.trim()
		filter.states = vnode.state.states

		// Parse tags: strip "#", then split on whitespace
		const tags = vnode.state.tags.replaceAll("#", "").trim()
		filter.tags = (tags == "") ? [] : tags.split(/\s+/).map((tag) => tag.trim())

		await vnode.attrs.controller.saveFilter(filter)
		vnode.attrs.close()
	}
}
