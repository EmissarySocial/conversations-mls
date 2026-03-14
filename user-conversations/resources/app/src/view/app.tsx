import m from "mithril"
import {type Vnode} from "mithril"
import {Controller} from "../service/controller"
import type {Config} from "../model/config"
import {Welcome} from "./welcome"
import {Index} from "."

type AppVnode = Vnode<AppAttrs, AppState>

type AppAttrs = {
	controller: Controller
}

type AppState = {
	modal: string
	config: Config
}

export class App {
	oninit(vnode: AppVnode) {
		vnode.state.modal = ""
	}

	view(vnode: AppVnode) {
		const controller = vnode.attrs.controller

		if (!controller.config.ready) {
			return <div class="app-content">Loading...</div>
		}

		if (!controller.config.welcome) {
			return <Welcome controller={controller} />
		}

		return <Index controller={controller} />
	}
}
