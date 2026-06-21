import m, { type Vnode } from "mithril"
import { ViewController } from "./controller"
import type { Config } from "../model/config"
import { Welcome } from "./welcome"
import { Index } from "."
import { AppBlurred } from "./app-blurred"
import { AppSettings } from "./app-settings"
import { AppStopped } from "./app-stopped"
import { AppSignIn } from "./app-signin"
import { AppLoading } from "./app-loading"

type AppVnode = Vnode<AppAttrs, AppState>

type AppAttrs = {
	controller: ViewController
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

		if (!controller.isApplicationRunning) {
			console.error(controller)
			return <AppStopped message={controller.stopReason} />
		}

		if (!controller.isWindowFocused) {
			if (controller.config.isHideOnBlur) {
				return <AppBlurred />
			}
		}

		switch (controller.pageView) {

			case "LOADING":
				return <AppLoading />

			case "SETTINGS":
				return <AppSettings controller={controller} />

			case "SIGN-IN":
				return <AppSignIn controller={controller} />

			case "WELCOME":
				return <Welcome controller={controller} />

			default:
				return <Index controller={controller} />
		}
	}
}
