import m from "mithril"
import type { ViewController } from "./controller"
import { synthClick } from "./utils"

type EmptyVnode = m.Vnode<EmptyAttrs, EmptyState>

type EmptyAttrs = {
	controller: ViewController
}

type EmptyState = {}

export class Empty {
	view(vnode: EmptyVnode) {
		return (
			<div class="flex-grow align-center padding-xl">
				<div>Messages will appear here when you</div>
				<div>
					<span class="link" role="link" tabIndex="0" onclick={() => vnode.attrs.controller.modal_newConversation()} onkeypress={synthClick}>
						Start a Conversation
					</span>
				</div>
			</div>
		)
	}
}
