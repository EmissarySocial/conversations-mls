import m from "mithril"
import type { Controller } from "../service/controller"
import { synthClick } from "./utils"
import { Popup } from "./widget-popup"

type FilterMenuVnode = m.Vnode<FilterMenuArgs, FilterMenuState>

interface FilterMenuArgs {
	controller: Controller
}

interface FilterMenuState { }

// FILTERS is a placeholder list of conversation filters. These will be replaced
// by dynamically-defined filters once filter management is built.
const FILTERS: { id: string, label: string }[] = [
	{ id: "", label: "All Conversations" },
	{ id: "important", label: "Important Only" },
	{ id: "archived", label: "Archived Only" },
]

// FilterMenu is the conversation filter pop-up. It uses the reusable Popup
// component to render a "filter" button and a menu of conversation filters.
// NOTE: the actual filtering of the list is not yet implemented.
export class FilterMenu {

	view(vnode: FilterMenuVnode) {

		const controller = vnode.attrs.controller

		return (
			<Popup
				trigger={(toggle: () => void) => (
					<div class="text-lg text-gray margin-none clickable" role="button" tabindex="0" onclick={toggle} onkeypress={synthClick}>
						<i class="bi bi-filter-circle"></i>
					</div>
				)}
				content={(close: () => void) => this.viewMenu(controller, close)}
			/>
		)
	}

	// viewMenu renders the body of the filter pop-up
	viewMenu(controller: Controller, close: () => void): m.Children {

		const selectedId = controller.config.selectedFilterId

		return (
			<div>
				{FILTERS.map(filter => (
					<div key={filter.label} class="filter-menu-item clickable" role="button" tabIndex="0" onclick={() => this.select(controller, close, filter.id)} onkeypress={synthClick}>
						<span class="filter-menu-icon">{(filter.id == selectedId) ? <i class="bi bi-check"></i> : null}</span>
						<span>{filter.label}</span>
					</div>
				))}

				<hr class="margin-vertical-sm" />

				<div class="filter-menu-item clickable" role="button" tabIndex="0" onclick={() => this.manage(controller, close)} onkeypress={synthClick}>
					<span class="filter-menu-icon"><i class="bi bi-gear"></i></span>
					<span>Manage Filters</span>
				</div>
			</div>
		)
	}

	// select applies the chosen filter and closes the pop-up
	select(controller: Controller, close: () => void, filterId: string) {
		controller.setConversationFilter(filterId)
		close()
	}

	// manage closes the pop-up and navigates to the settings "Filters" tab
	manage(controller: Controller, close: () => void) {
		close()
		controller.page_settings()
	}
}
