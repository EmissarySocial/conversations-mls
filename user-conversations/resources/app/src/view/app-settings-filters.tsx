import m from "mithril"

type FiltersVnode = m.Vnode<FiltersArgs, FiltersState>

interface FiltersArgs { }

interface FiltersState { }

// AppSettingsFilters renders the "Filters" settings tab. This is a placeholder
// for now; conversation-filter controls will be added here soon.
export class AppSettingsFilters {

	view(_vnode: FiltersVnode) {

		return (
			<div class="card padding">
				<div class="text-lg bold margin-bottom">Filters</div>
				<div class="text-gray">Conversation filters are coming soon.</div>
			</div>
		)
	}
}
