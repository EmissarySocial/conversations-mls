import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import { type APActor } from "../model/ap-actor"
import { Modal } from "./modal"

type MessageHistoryVnode = Vnode<MessageHistoryAttrs, MessageHistoryState>

interface MessageHistoryAttrs {
	controller: Controller
	close: () => void
}

interface MessageHistoryState {
	content: string
}

export class MessageHistory {

	oninit(vnode: MessageHistoryVnode) {
		vnode.state.content = vnode.attrs.controller.message.content
	}

	view(vnode: MessageHistoryVnode) {
		const message = vnode.attrs.controller.message
		return (
			<Modal close={vnode.attrs.close}>
				<h1><i class="bi bi-clock-history"></i> Message History</h1>
				<div class="table scroll-vertical margin-bottom" style="max-height:600px;">
					{message.history.map((content, index) => (
						<div>{index + 1}. {content}</div>
					))}
					<div>{message.history.length + 1}. {message.content}</div>
				</div>
				<button onclick={() => this.close(vnode)} tabIndex="0">Close</button>
			</Modal>
		)
	}

	close(vnode: MessageHistoryVnode) {
		vnode.attrs.controller.clearMessage()
		vnode.attrs.close()
	}
}
