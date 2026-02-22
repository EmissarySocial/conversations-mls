import m, {type Vnode} from "mithril"
import type {Controller} from "../controller"

type WidgetMessageCreateVnode = Vnode<WidgetMessageCreateAttrs, WidgetMessageCreateState>

type WidgetMessageCreateAttrs = {
	controller: Controller
}

type WidgetMessageCreateState = {
	message: string
}

export class WidgetMessageCreate {
	oninit(vnode: WidgetMessageCreateVnode) {
		vnode.state.message = ""
	}

	view(vnode: WidgetMessageCreateVnode) {
		return (
			<div role="input" class="flex-row">
				<textarea
					value={vnode.state.message}
					style="border:none; min-height:3em; field-sizing:content; resize:none;"
					oninput={(e: Event) => this.oninput(vnode, e)}></textarea>
				<button tabIndex="0" onclick={() => this.sendMessage(vnode)} disabled={vnode.state.message.trim() === ""}>
					<i class="bi bi-arrow-up-circle-fill" style="color:var(--blue50); font-size:24px;"></i>
				</button>
			</div>
		)
	}

	oninput(vnode: WidgetMessageCreateVnode, event: Event) {
		const target = event.target as HTMLTextAreaElement
		vnode.state.message = target.value
	}

	sendMessage(vnode: WidgetMessageCreateVnode) {
		if (vnode.state.message.trim() === "") {
			return
		}

		vnode.attrs.controller.sendMessage(vnode.state.message)
		vnode.state.message = ""
	}
}
