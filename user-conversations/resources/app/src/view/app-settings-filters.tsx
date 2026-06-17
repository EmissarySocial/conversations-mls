import m from "mithril"
import type { Controller } from "../service/controller"
import { NewFilter, type Filter } from "../model/filter"
import { WidgetFilterEdit, STATE_OPTIONS } from "./widget-filter-edit"
import { haltEvent, synthClick } from "./utils"

type FiltersVnode = m.Vnode<FiltersArgs, FiltersState>

interface FiltersArgs {
	controller: Controller
}

interface FiltersState {
	editFilter?: Filter
}

// AppSettingsFilters renders the "Filters" settings tab, where the user can
// create, edit, and delete their conversation filters.
export class AppSettingsFilters {

	view(vnode: FiltersVnode) {

		const filters = vnode.attrs.controller.filters

		return (
			<div class="card padding">
				<div class="text-lg bold margin-bottom">Filters</div>

				<div class="table">
					{filters.map((filter) => (
						<div key={filter.id} class="flex-row flex-align-center clickable" role="button" tabIndex="0" onclick={() => this.openEdit(vnode, filter)} onkeypress={synthClick}>
							<div class="flex-grow">
								<div class="bold">{filter.name}</div>
								<div class="text-sm text-gray">{this.summary(filter)}</div>
							</div>
							<div class="align-right">
								{(filters.length > 1) &&
									<button type="button" class="text-xs" onclick={(event: MouseEvent) => this.deleteFilter(event, vnode, filter)}>Remove</button>
								}
							</div>
						</div>
					))}
				</div>

				<div class="link margin-top" role="button" tabIndex="0" onclick={() => this.addFilter(vnode)} onkeypress={synthClick}>
					<i class="bi bi-plus"></i> Add a Filter
				</div>

				{vnode.state.editFilter &&
					<WidgetFilterEdit
						controller={vnode.attrs.controller}
						filter={vnode.state.editFilter}
						close={() => this.closeEdit(vnode)} />
				}
			</div>
		)
	}

	// summary describes a filter's states and tags in a single line
	summary(filter: Filter): string {
		const states = (filter.states ?? []).map((state) => STATE_OPTIONS.find((option) => option.state == state)?.label ?? state)
		const tags = (filter.tags ?? []).map((tag) => "#" + tag)
		return [...states, ...tags].join(" · ")
	}

	// addFilter opens the edit dialog for a brand-new filter
	addFilter(vnode: FiltersVnode) {
		vnode.state.editFilter = NewFilter()
	}

	// openEdit opens the edit dialog for an existing filter
	openEdit(vnode: FiltersVnode, filter: Filter) {
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
