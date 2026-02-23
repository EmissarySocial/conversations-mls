import m from "mithril"
import {Controller} from "../controller"
import {type Group} from "../model/group"
import {type Vnode, type VnodeDOM, type Component} from "mithril"

type SettingsVnode = Vnode<SettingsArgs, SettingsState>

interface SettingsArgs {
	controller: Controller
	group: Group
}

interface SettingsState {
	name: string
}

export class Settings {
	//

	oninit(vnode: SettingsVnode) {
		vnode.state.name = vnode.attrs.group.name
	}

	view(vnode: SettingsVnode) {
		//
		// List the settings
		const controller = vnode.attrs.controller
		const group = controller.group()
		const contacts = controller.contacts()
		const contactsList = Array.from(contacts.values())

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div class="flex-row flex-align-center">
						<button onclick={() => vnode.attrs.controller.page_messages()}>&larr;</button>
						<span class="bold text-lg">Settings for {group.name}</span>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<form onsubmit={(event: SubmitEvent) => this.onsubmit(event, vnode)}>
						<div class="layout layout-vertical">
							<div class="layout-elements">
								<div class="layout-element">
									<label for="idGroupName">Group Name</label>
									<input
										id="idGroupName"
										type="text"
										name="actorIds"
										value={vnode.state.name}
										oninput={(event: Event) => this.setName(vnode, event)}
									/>
								</div>
							</div>
						</div>
						<div class="margin-top flex-row">
							<div class="flex-grow">
								<button type="submit" class="primary" tabindex="0">
									Save Changes
								</button>
							</div>
							<div>
								<span
									onclick={() => {
										this.delete(vnode)
									}}
									class="clickable text-red">
									Leave Group
								</span>
							</div>
						</div>
					</form>
				</div>
			</div>
		)
	}

	setName(vnode: SettingsVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.name = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: SettingsVnode) {
		//
		// Halt the form submission to prevent a page reload
		event.preventDefault()
		event.stopPropagation()

		// Copy values from the form into the Group object
		vnode.attrs.group.name = vnode.state.name

		// Save the Group to the database
		await vnode.attrs.controller.saveGroup(vnode.attrs.group)

		// Success. Close the modal dialog and redraw the screen
		return this.close(vnode)
	}

	async delete(vnode: SettingsVnode) {
		//
		// Confirm the user's intent
		if (!confirm("Are you sure you want to leave this group? This action cannot be undone.")) {
			return
		}

		// Delete the group
		await vnode.attrs.controller.deleteGroup(vnode.attrs.group.id)

		// Close the modal dialog
		this.close(vnode)
	}

	close(vnode: SettingsVnode) {
		vnode.attrs.controller.page_messages()
	}
}
