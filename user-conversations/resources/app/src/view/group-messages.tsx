import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { WidgetMessageCreate } from "./widget-message-create"
import { ViewMessage } from "./message"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

type GroupMessagesVnode = Vnode<GroupMessagesAttrs, GroupMessagesState>

type GroupMessagesAttrs = {
	controller: Controller
}

type GroupMessagesState = {}

export class GroupMessages {
	oninit(vnode: GroupMessagesVnode) {
	}

	// view returns the JSX for the messages within the selectedGroup.
	// If there is no selected group, then a welcome message is shown instead.
	view(vnode: GroupMessagesVnode) {
		//
		// List the messages in the selected group
		const controller = vnode.attrs.controller
		var lastSender = ""
		var lastDate = ""

		// Display messages
		return (
			<div id="conversation-details">
				<div id="conversation-header">
					<div role="tablist" class="margin-none padding-none underlined">
						<div role="tab" aria-selected="true">{controller.groupName()}</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_notes()}>Notes</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_members()}>People ({controller.group.members.length})</div>
						<div role="tab" onclick={() => vnode.attrs.controller.page_group_leave()}>Leave</div>
					</div>
				</div>
				<div id="conversation-messages">
					<div class="flex-grow padding-sm padding-bottom-lg">
						{controller.messages.map(message => {

							const showSender = (message.sender != lastSender)

							/* HIDING THIS FOR NOW...
							var showDate = dayjs(message.createDate).fromNow()
							if (showDate == lastDate) {
								showDate = ""
							} else {
								lastDate = showDate
							}
							*/
							const showDate = ""

							return <ViewMessage controller={controller} message={message} showSender={showSender} showDate={showDate} />
						})}
					</div>
				</div>
				<div id="conversation-create-widget">
					<div class="padding-sm">
						<WidgetMessageCreate controller={vnode.attrs.controller} inReplyTo={vnode.attrs.controller.inReplyTo} />
					</div>
				</div>
			</div>
		)
	}
}
