import m from "mithril"
import type { ViewController as Controller } from "./controller"
import { synthClick } from "./utils"
import { Popup } from "./widget-popup"

type FilterMenuVnode = m.Vnode<FilterMenuArgs, FilterMenuState>

interface FilterMenuArgs {
	controller: Controller
}

interface FilterMenuState { }

// FilterMenu is the conversation filter pop-up. It uses the reusable Popup
// component to render a "filter" button and a menu of the user's conversation
// filters. NOTE: the actual filtering of the list is not yet implemented.
export class FilterMenu {

	view(vnode: FilterMenuVnode) {

		const controller = vnode.attrs.controller

		return (
			<Popup
				trigger={(toggle: () => void) => (
					<div class="text-lg text-gray padding-none margin-none clickable" role="button" tabindex="0" onclick={toggle} onkeypress={synthClick}>
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
				{controller.filters.map(filter => (
					<div key={filter.id} class="popup-menu-item clickable" role="button" tabIndex="0" onclick={() => this.select(controller, close, filter.id)} onkeypress={synthClick}>
						<span class="popup-menu-icon">{(filter.id == selectedId) ? <i class="bi bi-check"></i> : null}</span>
						<span>{filter.name}</span>
					</div>
				))}

				<hr class="margin-vertical-sm" />

				<div class="popup-menu-item clickable" role="button" tabIndex="0" onclick={() => this.manage(controller, close)} onkeypress={synthClick}>
					<span class="popup-menu-icon"><i class="bi bi-gear"></i></span>
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
