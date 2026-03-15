import m from "mithril"
import { type Vnode } from "mithril"
import { Controller } from "../service/controller"
import type { Config } from "../model/config"
import { Welcome } from "./welcome"
import { Index } from "."

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

		switch (controller.pageView) {

			case "LOADING":
				return <div class="app-content">Loading...</div>

			case "WELCOME":
				return <Welcome controller={controller} />

			default:
				return <Index controller={controller} />
		}
	}
}
