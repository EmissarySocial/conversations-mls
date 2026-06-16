import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import { savedNotice } from "./app-settings-saved"

type NotificationsVnode = Vnode<NotificationsArgs, NotificationsState>

interface NotificationsArgs {
	controller: Controller
	save: () => void
	saved: boolean
}

interface NotificationsState {
	isDesktopNotifications: boolean
	isSoundNotifications: boolean
	isHideOnBlur: boolean
	permission: "granted" | "denied" | "default"
}

// AppSettingsNotifications renders the "Notifications" settings tab,
// which controls desktop and sound notifications. Edits are held in local
// state and only applied to the config when the user clicks "Save Changes".
export class AppSettingsNotifications {

	oninit(vnode: NotificationsVnode) {
		const config = vnode.attrs.controller.config
		vnode.state.isDesktopNotifications = config.isDesktopNotifications
		vnode.state.isSoundNotifications = config.isSoundNotifications
		vnode.state.isHideOnBlur = config.isHideOnBlur
		vnode.state.permission = Notification.permission
	}

	view(vnode: NotificationsVnode) {

		const controller = vnode.attrs.controller

		return (
			<div class="card padding">
				<div class="text-lg bold margin-bottom">Notifications</div>

				<div class="layout-vertical">
					<div class="layout-elements">

						<div class="layout-element flex-row">
							<input type="checkbox" tabIndex="0" id="isDesktopNotifications" checked={vnode.state.isDesktopNotifications} disabled={vnode.state.permission === "denied"} onchange={(event: Event) => this.setDesktopNotifications(vnode, event)} style="height:1em; width:1em;" />
							<label for="isDesktopNotifications">
								<div>{(vnode.state.permission == "granted") ? "Allow Desktop Notifications" : "Desktop Notifications Denied"}</div>
								{vnode.state.permission === "denied" && <div class="text-xs text-gray margin-right-xs">To re-enable desktop notifications, go to your browser settings.</div>}
							</label>
						</div>

						<div class="layout-element flex-row">
							<input type="checkbox" tabIndex="0" id="isSoundNotifications" checked={vnode.state.isSoundNotifications} onchange={(event: Event) => this.setSoundNotifications(vnode, event)} style="height:1em; width:1em;" />
							<label for="isSoundNotifications"> {/* NOSONOR: typescript:S6853 */}
								<div>Play Sound for New Messages</div>
							</label>
						</div>

						<div class="layout-element flex-row">
							<input type="checkbox" tabIndex="0" id="isHideOnBlur" checked={vnode.state.isHideOnBlur} onchange={(event: Event) => this.setHideOnBlur(vnode, event)} style="height:1em; width:1em;" />
							<label for="isHideOnBlur"> {/* NOSONOR: typescript:S6853 */}
								<div>Hide When Window Loses Focus</div>
							</label>
						</div>

					</div>
				</div>

				<div class="margin-top flex-row flex-align-center">
					<button class="primary" onclick={() => this.saveChanges(vnode)}>Save Changes</button>
					<button onclick={() => controller.page_index()}>Cancel</button>
					{savedNotice(vnode.attrs.saved)}
				</div>
			</div>
		)
	}

	async setDesktopNotifications(vnode: NotificationsVnode, event: Event) {

		const target = event.target as HTMLInputElement

		if (target.checked) {
			const permission = await Notification.requestPermission()
			vnode.state.permission = permission
			vnode.state.isDesktopNotifications = (permission == "granted")
			m.redraw()
			return
		}

		vnode.state.isDesktopNotifications = false
	}

	setSoundNotifications(vnode: NotificationsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isSoundNotifications = target.checked
	}

	setHideOnBlur(vnode: NotificationsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
	}

	// saveChanges applies the local edits to the config and persists them
	saveChanges(vnode: NotificationsVnode) {
		const config = vnode.attrs.controller.config
		config.isDesktopNotifications = vnode.state.isDesktopNotifications
		config.isSoundNotifications = vnode.state.isSoundNotifications
		config.isHideOnBlur = vnode.state.isHideOnBlur
		vnode.attrs.save()
	}
}
