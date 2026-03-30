import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"

type GroupsVnode = Vnode<GroupsAttrs, GroupsState>

type GroupsAttrs = {
	controller: Controller
}

type GroupsState = {}

export class Groups {
	view(vnode: GroupsVnode) {
		const controller = vnode.attrs.controller

		return (
			<div>
				<div class="flex-row flex-align-center padding-horizontal">
					<div class="bold text-lg margin-none flex-grow">Conversations</div>
					<div class="link text-lg margin-none" onclick={() => controller.modal_newConversation()} tabindex="0">
						<i class="bi bi-plus-circle-fill"></i>
					</div>
				</div>

				<div class="flex-row flex-align-center padding text-sm">
					<div role="input" class="flex-grow flex-row flex-align-center">
						<label class="bi bi-search" for="idSearch"></label>
						<input
							id="idSearch"
							type="text"
							placeholder="Search"
							class="flex-grow margin-none padding-none"
							style="border:none; outline:none;"
						/>
					</div>
					<div class="text-lg text-gray margin-none clickable" tabindex="0">
						<i class="bi bi-filter-circle"></i>
					</div>
				</div>

				<hr class="margin-vertical-sm" />

				{controller.groups.map((group) => {
					var cssClass = "flex-row flex-align-center padding hover-trigger"

					if (group.id == controller.selectedGroupId()) {
						cssClass += " highlight"
					}

					return (
						<div role="button" class={cssClass} onclick={() => controller.selectGroup(group.id)}>
							<div class="width-48 circle flex-center">
								<i class="bi bi-lock-fill"></i>
							</div>
							<div class="flex-grow nowrap ellipsis">
								<div>{controller.groupName(group)}</div>
								<div class="text-xs text-light-gray ellipsis-multiline-2">{group.lastMessage}</div>
							</div>
						</div>
					)
				})}
			</div>
		)
	}
}
