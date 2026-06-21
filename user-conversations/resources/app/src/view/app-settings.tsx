import m, { type Vnode } from "mithril"
import type { ViewController, SettingsTab } from "./controller"
import { synthClick } from "./utils"
import { AppSettingsGeneral } from "./app-settings-general"
import { AppSettingsFilters } from "./app-settings-filters"
import { AppSettingsSignout } from "./app-settings-signout"

type AppSettingsVnode = Vnode<AppSettingsArgs, AppSettingsState>

interface AppSettingsArgs {
	controller: ViewController
}

interface AppSettingsState {
}

// AppSettings is the shell for the settings screen. It mirrors the conversations
// layout with a sidebar of tabs on the left and the selected section on the right.
// The active tab lives on the controller so it survives the component being
// unmounted and remounted (e.g. when the window loses and regains focus).
export class AppSettings {

	view(vnode: AppSettingsVnode) {

		return (
			<div id="conversations">
				<div id="app-sidebar" class="table no-top-border flex-shrink-0 scroll-vertical" style="width:30%">
					{this.viewSidebar(vnode)}
				</div>

				<div class="app-content scroll-vertical flex-grow padding">
					<div class="max-width-800">
						{this.viewSection(vnode)}
						<div class="padding-vertical-xl"></div>
					</div>
				</div>
			</div>
		)
	}

	// viewSidebar renders the back button, title, and tab navigation
	viewSidebar(vnode: AppSettingsVnode): JSX.Element {

		const controller = vnode.attrs.controller

		return (
			<div>
				<div class="flex-row flex-align-center padding-horizontal">
					<div class="flex-row flex-align-center clickable" role="link" tabIndex="0" onclick={() => controller.page_index()} onkeypress={synthClick}>
						<div class="circle width-32 margin-none flex-center text-lg"><i class="bi bi-arrow-left"></i></div>
						<div class="bold text-lg margin-none">Settings</div>
					</div>
				</div>

				<hr class="margin-vertical-sm" />

				{this.viewTab(vnode, "GENERAL", "gear", "General")}
				{this.viewTab(vnode, "FILTERS", "filter-circle", "Filters")}
				{this.viewTab(vnode, "SIGNOUT", "door-open", "Sign Out / Erase")}
			</div>
		)
	}

	// viewTab renders a single navigation row in the sidebar. The icon argument is
	// a Bootstrap Icon stem (e.g. "shield"); the unselected tab uses the outline
	// style and the selected tab uses the "-fill" variant.
	viewTab(vnode: AppSettingsVnode, tab: SettingsTab, icon: string, label: string): JSX.Element {

		const isSelected = (vnode.attrs.controller.settingsTab == tab)

		let cssClass = "flex-row flex-align-center padding hover-trigger clickable"

		if (isSelected) {
			cssClass += " highlight"
		}

		const iconClass = "bi bi-" + icon + (isSelected ? "-fill" : "")

		return (
			<div class={cssClass} role="button" tabIndex="0" onclick={() => this.selectTab(vnode, tab)} onkeypress={synthClick}>
				<i class={iconClass}></i> <span class={isSelected ? "bold" : ""}>{label}</span>
			</div>
		)
	}

	// viewSection renders the content for the currently selected tab
	viewSection(vnode: AppSettingsVnode): JSX.Element {

		const controller = vnode.attrs.controller

		switch (controller.settingsTab) {

			case "GENERAL":
				return <AppSettingsGeneral controller={controller} />

			case "SIGNOUT":
				return <AppSettingsSignout controller={controller} />

			case "FILTERS":
			default:
				return <AppSettingsFilters controller={controller} />
		}
	}

	selectTab(vnode: AppSettingsVnode, tab: SettingsTab) {
		vnode.attrs.controller.settingsTab = tab
	}
}
