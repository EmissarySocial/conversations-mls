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
	tags: string
}

export class Settings {
	//

	oninit(vnode: SettingsVnode) {
		vnode.state.name = vnode.attrs.group.name

		if (vnode.attrs.group.tags == undefined) {
			vnode.attrs.group.tags = []
		}
		vnode.state.tags = vnode.attrs.group.tags.map((tag) => "#" + tag).join(" ")
		console.log(vnode.state.tags)
		console.log(vnode.attrs.group.tags)
	}

	view(vnode: SettingsVnode) {
		//
		// List the settings
		const controller = vnode.attrs.controller

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div class="flex-row flex-align-center">
						<button onclick={() => vnode.attrs.controller.page_messages()}>&larr;</button>
						<span class="bold text-lg">Settings for {controller.group.name}</span>
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
										value={vnode.state.name}
										oninput={(event: Event) => this.setName(vnode, event)}
									/>
								</div>
							</div>
							<div class="layout-elements">
								<div class="layout-element">
									<label for="idGroupTags">Tags</label>
									<input
										id="idGroupTags"
										type="text"
										value={vnode.state.tags}
										oninput={(event: Event) => this.setTags(vnode, event)}
									/>
									<div class="text-xs text-gray">#hashtags (separated by spaces) help you organize conversations.</div>
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
		const target = event.target as HTMLInputElement
		vnode.state.name = target.value
	}

	setTags(vnode: SettingsVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.tags = target.value
	}

	async onsubmit(event: SubmitEvent, vnode: SettingsVnode) {
		//
		// Halt the form submission to prevent a page reload
		event.preventDefault()
		event.stopPropagation()

		// Copy values from the form into the Group object
		vnode.attrs.group.name = vnode.state.name

		// Clean up tags input
		vnode.state.tags = vnode.state.tags.replaceAll("#", "")
		vnode.state.tags = vnode.state.tags.trim()

		if (vnode.state.tags.trim() == "") {
			vnode.attrs.group.tags = []
		} else {
			vnode.attrs.group.tags = vnode.state.tags.split(/\s+/).map((tag) => tag.trim())
		}

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
