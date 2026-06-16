import m from "mithril"
import { Controller } from "../service/controller"
import { groupIsEncrypted, type Group } from "../model/group"
import { synthClick } from "./utils"
import { FilterMenu } from "./widget-filterMenu"

type GroupsVnode = m.Vnode<GroupsAttrs, GroupsState>

type GroupsAttrs = {
	controller: Controller
}

type GroupsState = {}

export class Groups {

	view(vnode: GroupsVnode) {
		const controller = vnode.attrs.controller

		return (
			<div class="conversations-pane">
				<div class="flex-row flex-align-center padding-horizontal">
					<div class="flex-row flex-align-center clickable hover-trigger" role="link" tabIndex="0" onclick={() => controller.page_settings()} onkeypress={synthClick}>
						<div class="circle width-32 hover-show text-lg margin-none align-center"><i class="bi bi-gear"></i></div>
						<img src={controller.actorIcon()} class="width-32 circle hover-hide" alt="" />
						<div class="bold text-lg margin-none">Conversations</div>
					</div>
					<div class="flex-grow"></div>
					<div class="link text-lg margin-none" role="button" tabindex="0" onclick={() => controller.modal_newConversation()} onkeypress={synthClick}>
						<i class="bi bi-plus-circle-fill"></i>
					</div>
				</div>

				<div class="flex-row flex-align-center padding text-sm">
					<div role="textbox" class="flex-grow flex-row flex-align-center">
						<label class="bi bi-search" for="idSearch">{/* NOSONOR typescript:S6853 */}</label>
						<input
							id="idSearch"
							type="text"
							placeholder="Search"
							class="flex-grow margin-none padding-none"
							style="border:none; outline:none;"
						/>
					</div>
					<FilterMenu controller={controller} />
				</div>

				<hr class="margin-vertical-sm" />

				<div class="conversations-scroll">
					{controller.groups.map((group) => {
						let cssClass = "flex-row flex-align-center padding hover-trigger"

						if (group.id == controller.selectedGroupId()) {
							cssClass += " highlight"
						}

						return (
							<div key={group.id} class={cssClass} role="button" tabIndex="0" onclick={() => controller.selectGroup(group.id)} onkeypress={synthClick}>
								<div class="width-48 circle flex-center" style={`color:var(--white); background-color:${this.groupColor(group)}`}>
									{this.groupIcon(group)}
								</div>
								<div class="flex-row flex-grow nowrap ellipsis pos-relative">
									<div class="flex-grow">
										{this.groupLabel(group)}
									</div>
									{this.unreadMarker(vnode, group)}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	groupColor(group: Group): string {

		if (group.stateId == "WELCOME") {
			return "var(--gray50)"
		}

		if (groupIsEncrypted(group)) {
			return "var(--blue50)"
		}

		return "var(--green70)"
	}

	groupIcon(group: Group): JSX.Element {

		if (groupIsEncrypted(group)) {
			return <i class="bi bi-lock-fill"></i>
		}

		return <i class="bi bi-chat-fill"></i>
	}

	groupLabel(group: Group): JSX.Element {

		if (group.stateId == "WELCOME") {
			return <>
				<div class="bold">Invitation ({groupIsEncrypted(group) ? "Encrypted" : "Plaintext"})</div>
				<div class="text-xs text-light-gray ellipsis-multiline-2">{group.defaultName || ""}</div>
			</>
		}

		return <>
			<div class="flex-row bold">{group.name || group.defaultName || ""}</div>
			<div class="text-xs text-light-gray ellipsis-multiline-2">{group.lastMessage || ""}</div>
		</>
	}

	unreadMarker(vnode: GroupsVnode, group: Group) {

		if (!group.unread) {
			return null
		}

		if (groupIsEncrypted(group)) {
			return <div class="text-xs" style="color:var(--blue50);">
				<i class="bi bi-circle-fill"></i>
			</div>
		}

		return <div class="text-xs" style="color:var(--green50);">
			<i class="bi bi-circle-fill"></i>
		</div>
	}
}
