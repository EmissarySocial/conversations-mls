import m, { type Vnode } from "mithril"
import type { Group } from "../model/group"
import type { Controller } from "../service/controller"
import { haltEvent } from "./utils"

type AppSettingsVnode = Vnode<AppSettingsArgs, AppSettingsState>

interface AppSettingsArgs {
	controller: Controller
	group: Group
}

interface AppSettingsState {
	name: string
	passcode: string
	isDesktopNotifications: boolean
	isDesktopNotificationsPermission: "granted" | "denied" | "default"
	isHideOnBlur: boolean
}

export class AppSettings {

	oninit(vnode: AppSettingsVnode) {
		const controller = vnode.attrs.controller

		vnode.state.name = controller.config.clientName
		vnode.state.passcode = controller.config.passcode
		vnode.state.isHideOnBlur = controller.config.isHideOnBlur
		vnode.state.isDesktopNotifications = controller.config.isDesktopNotifications
		vnode.state.isDesktopNotificationsPermission = Notification.permission
	}

	view(vnode: AppSettingsVnode) {

		const controller = vnode.attrs.controller

		return (
			<div id="conversations">
				<div class="padding width-800">
					<div class="card padding">
						<div class="text-lg bold margin-bottom">Conversation Settings</div>
						<form onsubmit={(event: SubmitEvent) => this.submit(event, vnode)}>
							<div class="layout-vertical">
								<div class="layout-elements">
									<div class="layout-element flex-row">
										<input type="checkbox" id="isDesktopNotifications" checked={vnode.state.isDesktopNotifications} disabled={vnode.state.isDesktopNotificationsPermission === "denied"} onchange={(event: Event) => this.setDesktopNotifications(vnode, event)} style="height:1em; width:1em;" />
										<label for="isDesktopNotifications">
											<div>{(vnode.state.isDesktopNotificationsPermission != "denied") ? "Allow Desktop Notifications" : "Desktop Notifications Denied"}</div>
											{vnode.state.isDesktopNotificationsPermission === "denied" && <div class="text-xs text-gray margin-right-xs">To re-enable desktop notifications, go to your browser settings.</div>}
										</label>
									</div>
									<div class="layout-element flex-row">
										<input type="checkbox" id="isHideOnBlur" checked={vnode.state.isHideOnBlur} onchange={(event: Event) => this.setHideOnBlur(vnode, event)} style="height:1em; width:1em;" />
										<label for="isHideOnBlur">
											<div>Hide When Window Loses Focus</div>
										</label>
									</div>
								</div>
							</div>

							<button type="submit" class="primary">Save Settings</button>
							<button onclick={() => controller.page_index()}>Cancel</button>
						</form>
					</div>

					<div class="card padding margin-top">
						<div class="text-lg bold margin-bottom">Sign Out</div>
						<div class="layout-vertical margin-top">
							<div class="layout-elements">
								<div class="layout-element">
									Clear out your current session to safeguard your private data. Only encrypted
									data will remain on this device.
								</div>
							</div>
						</div>

						<button class="text-red" onclick={() => controller.stop()}>Sign Out</button>
					</div>
				</div>
			</div>
		)
	}

	async setDesktopNotifications(vnode: AppSettingsVnode, event: Event) {
		const target = event.target as HTMLInputElement

		if (target.checked) {
			const permission = await Notification.requestPermission()
			vnode.state.isDesktopNotificationsPermission = permission

			if (permission == "granted") {
				vnode.state.isDesktopNotifications = true
				return
			}

		}

		vnode.state.isDesktopNotifications = false
	}

	setHideOnBlur(vnode: AppSettingsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
	}

	submit(event: SubmitEvent, vnode: AppSettingsVnode) {

		// Halt form submission and page reload
		haltEvent(event)

		// Save the configuration
		const controller = vnode.attrs.controller
		controller.saveConfiguration(
			vnode.state.name,
			vnode.state.passcode,
			vnode.state.isDesktopNotifications,
			vnode.state.isHideOnBlur,
		)

		// Return to the message index
		vnode.attrs.controller.page_index()
	}
}

/*
import m from "mithril"
import { type Vnode } from "mithril"

import { type Group } from "../model/group"
import { Controller } from "../service/controller"
import { haltEvent } from "./utils"

type AppSettingsVnode = Vnode<AppSettingsArgs, AppSettingsState>

interface AppSettingsArgs {
	controller: Controller
	group: Group
}

interface AppSettingsState {
	name: string
	passcode: string
	isDesktopNotifications: boolean
	isDesktopNotificationsPermission: "granted" | "denied" | "default"
	isHideOnBlur: boolean
}

export class AppSettings {

	view = (vnode: AppSettingsVnode) => {

		return (
			<div id="conversations" class="flex-center">Here</div>
		)
	}

	oninit = (vnode: AppSettingsVnode) => {
		const controller = vnode.attrs.controller

		vnode.state.name = controller.config.clientName
		vnode.state.passcode = controller.config.passcode
		vnode.state.isHideOnBlur = controller.config.isHideOnBlur
		vnode.state.isDesktopNotifications = controller.config.isDesktopNotifications
		vnode.state.isDesktopNotificationsPermission = Notification.permission
	}

	view = (vnode: AppSettingsVnode) => {

		const controller = vnode.attrs.controller

		return (
			<div id="conversations" class="flex-center">
				<div class="card padding width-800">

					<form onsubmit={(event: SubmitEvent) => this.submit(event, vnode)}>
						<div class="layout-vertical">
							<div class="layout-elements">
								<div class="layout-element flex-row">
									<input type="checkbox" id="isDesktopNotifications" checked={vnode.state.isDesktopNotifications} disabled={vnode.state.isDesktopNotificationsPermission === "denied"} onchange={(event: Event) => this.setDesktopNotifications(vnode, event)} style="height:1em; width:1em;" />
									<label for="isDesktopNotifications">
										<div>{(vnode.state.isDesktopNotificationsPermission != "denied") ? "Allow Desktop Notifications" : "Desktop Notifications Denied"}</div>
										{vnode.state.isDesktopNotificationsPermission === "denied" && <div class="text-xs text-gray margin-right-xs">To re-enable desktop notifications, go to your browser settings.</div>}
									</label>
								</div>
								<div class="layout-element flex-row">
									<input type="checkbox" id="isHideOnBlur" checked={vnode.state.isHideOnBlur} onchange={(event: Event) => this.setHideOnBlur(vnode, event)} style="height:1em; width:1em;" />
									<label for="isHideOnBlur">
										<div>Hide When Window Loses Focus</div>
									</label>
								</div>
							</div>
						</div>

						<button type="submit" class="primary">Save Settings</button>
						<button onclick={() => controller.page_index()}>Cancel</button>
					</form>
				</div>
			</div>
		)
	}

	setDesktopNotifications = async (vnode: AppSettingsVnode, event: Event) => {
		const target = event.target as HTMLInputElement

		if (target.checked) {
			const permission = await Notification.requestPermission()
			vnode.state.isDesktopNotificationsPermission = permission

			if (permission == "granted") {
				vnode.state.isDesktopNotifications = true
				return
			}

		}

		vnode.state.isDesktopNotifications = false
	}

	setHideOnBlur = (vnode: AppSettingsVnode, event: Event) => {
		const target = event.target as HTMLInputElement
		vnode.state.isHideOnBlur = target.checked
	}

	submit = (event: SubmitEvent, vnode: AppSettingsVnode) => {

		// Halt form submission and page reload
		haltEvent(event)

		// Save the configuration
		const controller = vnode.attrs.controller
		controller.saveConfiguration(
			vnode.state.name,
			vnode.state.passcode,
			vnode.state.isDesktopNotifications,
			vnode.state.isHideOnBlur,
		)

		// Return to the message index
		vnode.attrs.controller.page_index()
	}
	
}
*/