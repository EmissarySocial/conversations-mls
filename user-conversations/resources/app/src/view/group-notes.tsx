import m, { type Vnode } from "mithril"

import { type Group } from "../model/group"
import { Controller } from "../service/controller"
import { haltEvent, synthClick } from "./utils"

type GroupNotesVnode = Vnode<GroupNotesArgs, GroupNotesState>

interface GroupNotesArgs {
	controller: Controller
}

interface GroupNotesState {
	group: Group
	tags: string
}

export class GroupNotes {

	oninit(vnode: GroupNotesVnode) {
		vnode.state.group = vnode.attrs.controller.groupStream()
		vnode.state.tags = vnode.state.group.tags.map((tag) => "#" + tag).join(" ")
	}

	view(vnode: GroupNotesVnode) {

		// Collect variables
		const controller = vnode.attrs.controller
		const group = vnode.state.group

		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" tabIndex="0" onclick={() => controller.page_group_messages()} onkeypress={synthClick}>{group.name || group.defaultName || "Messages"}</div>
						<div role="tab" aria-selected="true">Notes</div>
						<div role="tab" tabIndex="0" onclick={() => controller.page_group_members()} onkeypress={synthClick}>People ({group.members.length})</div>
					</div>
				</div>
				<div id="conversation-messages" class="padding">
					<form onsubmit={(event: SubmitEvent) => this.save(event, vnode)}>
						<div class="card padding max-width-640">
							<div class="layout layout-vertical">
								<div class="layout-elements">
									<div class="layout-element">
										<label for="idGroupName">Custom Name</label> {/* NOSONAR:typescript:S6853 "for" works fine in Mithril */}
										<input
											id="idGroupName"
											type="text"
											value={vnode.state.group.name}
											oninput={(event: Event) => this.setName(vnode, event)}
										/>
										<div class="text-xs text-gray">(PRIVATE) helps you organize conversations. If empty, member list is displayed.</div>
									</div>
									<div class="layout-element">
										<label for="idGroupNotes">Notes</label> {/* NOSONAR:typescript:S6853 "for" works fine in Mithril */}
										<textarea
											id="idGroupNotes"
											value={vnode.state.group.summary}
											rows="8"
											oninput={(event: Event) => this.setSummary(vnode, event)}
										/>
										<div class="text-xs text-gray">(PRIVATE) Notes about this conversation. Not shared with other group members.</div>
									</div>

									{this.widgetState(vnode)}

									<div class="layout-element">
										<label for="idGroupTags">Tags</label> {/* NOSONAR:typescript:S6853 "for" works fine in Mithril */}
										<input
											id="idGroupTags"
											type="text"
											placeholder="#add #hashtags #here"
											value={vnode.state.tags}
											oninput={(event: Event) => this.setTags(vnode, event)}
										/>
										<div class="text-xs text-gray">(PRIVATE) Organizes conversations using conversation filters.</div>
									</div>
								</div>
							</div>
							<div class="margin-top flex-row">
								<div class="flex-grow">
									<button type="submit" class="primary" tabindex="0">
										Save Changes
									</button>
								</div>
							</div>
						</div>
					</form>
				</div>
			</div>
		)
	}


	widgetState(vnode: GroupNotesVnode) {

		// If if CLOSED, read only view
		if (vnode.state.group.stateId === "CLOSED") {

			return <div class="layout-element" >
				<label for="idGroupState">Status</label> {/* NOSONAR:typescript:S6853 "for" works fine in Mithril */}

				<select disabled>
					<option>Closed</option>
				</select>
				<div class="text-xs text-gray">This group is closed and you can no longer post to it.</div>
			</div>
		}

		// Otherwise, show a select box to change the state
		return <div class="layout-element" >
			<label for="idGroupState">Status</label> {/* NOSONAR:typescript:S6853 "for" works fine in Mithril */}

			<select
				id="idGroupState"
				value={vnode.state.group.stateId}
				oninput={(event: Event) => this.setState(vnode, event)}>

				<option value="IMPORTANT">Important</option>
				<option value="ACTIVE">Active</option>
				<option value="ARCHIVED">Archived</option>
			</select>
			<div class="text-xs text-gray">(PRIVATE) Organizes conversations using conversation filters.</div>
		</div>
	}

	setName(vnode: GroupNotesVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.group.name = target.value
	}

	setSummary(vnode: GroupNotesVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.group.summary = target.value
	}

	setState(vnode: GroupNotesVnode, event: Event) {
		const target = event.target as HTMLSelectElement

		switch (target.value) {
			case "IMPORTANT":
			case "ACTIVE":
			case "ARCHIVED":
				vnode.state.group.stateId = target.value
		}
	}

	setTags(vnode: GroupNotesVnode, event: Event) {
		const target = event.target as HTMLInputElement
		vnode.state.tags = target.value
	}

	async save(event: SubmitEvent, vnode: GroupNotesVnode) {

		// Prevent page reload
		haltEvent(event)

		// Clean up tags input
		vnode.state.tags = vnode.state.tags.replaceAll("#", "")
		vnode.state.tags = vnode.state.tags.trim()

		if (vnode.state.tags.trim() == "") {
			vnode.state.group.tags = []
		} else {
			vnode.state.group.tags = vnode.state.tags.split(/\s+/).map((tag) => tag.trim())
		}

		// Save the Group to the database
		await vnode.attrs.controller.saveGroupAndSync(vnode.state.group)

		// Success. Close the modal dialog and redraw the screen
		return this.close(vnode)
	}

	async delete(vnode: GroupNotesVnode) {

		// Confirm the user's intent
		if (!confirm("Are you sure you want to leave this group? This action cannot be undone.")) {
			return
		}

		// Delete the group
		await vnode.attrs.controller.leaveGroup(vnode.state.group.id)

		// Close the modal dialog
		this.close(vnode)
	}

	close(vnode: GroupNotesVnode) {
		vnode.attrs.controller.page_group_messages()
	}
}
