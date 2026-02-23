import m from "mithril"
import type {Controller} from "../controller"

type EmptyVnode = m.Vnode<EmptyAttrs, EmptyState>

type EmptyAttrs = {
	controller: Controller
}

type EmptyState = {}

export class Empty {
	view(vnode: EmptyVnode) {
		return (
			<div class="flex-grow align-center padding-xl">
				<div>Messages will appear here when you</div>
				<div>
					<span class="link" onclick={() => vnode.attrs.controller.modal_newConversation()}>
						Start a Conversation
					</span>
				</div>
			</div>
		)
	}
}
