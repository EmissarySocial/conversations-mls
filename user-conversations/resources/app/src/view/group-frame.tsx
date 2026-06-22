import m, { type Vnode } from "mithril"

import { ViewController } from "./controller"
import { groupColor } from "../model/group"
import { GroupMenu } from "./widget-groupMenu"
import { isNarrow } from "./responsive"
import { synthClick } from "./utils"

// GroupTab identifies which tab is currently active in the group frame.
export type GroupTab = "messages" | "notes" | "members" | "leave"

interface GroupFrameArgs {
	controller: ViewController
	// active marks which tab is selected (rendered as aria-selected, non-clickable).
	active: GroupTab
}

type GroupFrameVnode = Vnode<GroupFrameArgs, {}>

// GroupFrame is the shared chrome for the per-conversation pages (messages, notes,
// people, leave). It owns the `#conversation-details` root — including the group's
// `--focus-color` accent, applied once here so every child page's inputs, tab
// underline, and themed controls stay in sync — the `#conversation-header` tablist,
// and the per-conversation "···" menu (shown on every tab). Each page supplies its
// own body as children. (The welcome/invite screen has no tabs and deliberately
// does not use this frame.)
export class GroupFrame {

	view(vnode: GroupFrameVnode) {

		const { controller, active } = vnode.attrs
		const group = controller.groupStream()
		const groupName = group.name || group.defaultName || "Messages"

		return (
			<div id="conversation-details" style={{ "--focus-color": groupColor(group) }}>
				<div id="conversation-header" class="flex-row flex-align-center">
					{isNarrow() &&
						<div class="clickable margin-right-sm" role="button" tabindex="0" title="Back to conversations" aria-label="Back to conversations" onclick={() => controller.page_index()} onkeypress={synthClick}>
							<i class="bi bi-arrow-left text-lg"></i>
						</div>
					}
					<div role="tablist" class="margin-none padding-none underlined flex-grow">
						{this.tab(controller, active, "messages", groupName, () => controller.page_group_messages())}
						{this.tab(controller, active, "notes", "Notes", () => controller.page_group_notes())}
						{this.tab(controller, active, "members", "People (" + group.members.length + ")", () => controller.page_group_members())}
						{(active == "leave") && <div role="tab" aria-selected="true">Leave</div>}
					</div>
					<GroupMenu controller={controller} group={group} />
				</div>
				{vnode.children}
			</div>
		)
	}

	// tab renders a single header tab. The active tab is marked aria-selected and is
	// not clickable; the rest navigate to their page.
	tab(controller: ViewController, active: GroupTab, tab: GroupTab, label: string, navigate: () => void): m.Children {

		if (active == tab) {
			return <div role="tab" aria-selected="true">{label}</div>
		}

		return <div role="tab" tabIndex="0" onclick={navigate} onkeypress={synthClick}>{label}</div>
	}
}
