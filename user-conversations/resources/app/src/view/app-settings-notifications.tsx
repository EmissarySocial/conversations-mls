import m, { type Vnode } from "mithril"
import type { Controller } from "../service/controller"
import { SavedNotice } from "./widget-saved-notice"

type NotificationsVnode = Vnode<NotificationsArgs, NotificationsState>

interface NotificationsArgs {
	controller: Controller
}

interface NotificationsState {
	isDesktopNotifications: boolean
	isSoundNotifications: boolean
	isHideOnBlur: boolean
	permission: "granted" | "denied" | "default"
	saved: boolean
	savedTimeout?: ReturnType<typeof setTimeout>
}

// AppSettingsNotifications renders the "Notifications" settings tab, which
// controls desktop and sound notifications. Changes are saved automatically as
// soon as a value is toggled, and a transient "Changes saved" notice is shown.
export class AppSettingsNotifications {

	oninit(vnode: NotificationsVnode) {
		const config = vnode.attrs.controller.config
		vnode.state.isDesktopNotifications = config.isDesktopNotifications
		vnode.state.isSoundNotifications = config.isSoundNotifications
		vnode.state.isHideOnBlur = config.isHideOnBlur
		vnode.state.permission = Notification.permission
		vnode.state.saved = false
	}

	onremove(vnode: NotificationsVnode) {
		if (vnode.state.savedTimeout != undefined) {
			clearTimeout(vnode.state.savedTimeout)
		}
	}

	view(vnode: NotificationsVnode) {

		return (
			<div>
				<div class="flex-row flex-align-center margin-bottom">
					<div class="text-lg bold flex-grow">Notifications</div>
					<SavedNotice saved={vnode.state.saved} />
				</div>

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
			</div>
		)
	}

	async setDesktopNotifications(vnode: NotificationsVnode, event: Event) {

		const target = event.target as HTMLInputElement

		if (target.checked) {
			const permission = await Notification.requestPermission()
			vnode.state.permission = permission
			vnode.state.isDesktopNotifications = (permission == "granted")
			this.save(vnode)
			m.redraw()
			return
		}

		vnode.state.isDesktopNotifications = false
		this.save(vnode)
	}

	setSoundNotifications(vnode: NotificationsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isSoundNotifications = target.checked
		this.save(vnode)
	}

	setHideOnBlur(vnode: NotificationsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
		this.save(vnode)
	}

	// save applies the current values to the config, persists them, and shows the
	// transient "Changes saved" notice for three seconds.
	save(vnode: NotificationsVnode) {

		const controller = vnode.attrs.controller
		controller.config.isDesktopNotifications = vnode.state.isDesktopNotifications
		controller.config.isSoundNotifications = vnode.state.isSoundNotifications
		controller.config.isHideOnBlur = vnode.state.isHideOnBlur
		controller.saveConfig()

		// Show the "Changes saved" confirmation and hide it again after two seconds
		vnode.state.saved = true

		if (vnode.state.savedTimeout != undefined) {
			clearTimeout(vnode.state.savedTimeout)
		}

		vnode.state.savedTimeout = setTimeout(() => {
			vnode.state.saved = false
			m.redraw()
		}, 2000)
	}
}
