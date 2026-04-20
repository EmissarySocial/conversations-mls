import m from "mithril"
import { type Vnode } from "mithril"

import { Controller } from "../service/controller"
import { haltEvent } from "./utils"


type AppSignInVnode = Vnode<AppSignInArgs, AppSignInState>

interface AppSignInArgs {
	controller: Controller
}

interface AppSignInState {
	passcode: string
	requestPending: boolean
	message: string
	input: HTMLInputElement | null
}

export class AppSignIn {

	public oninit(vnode: AppSignInVnode) {
		vnode.state.passcode = ""
		vnode.state.requestPending = false
	}

	public oncreate(vnode: AppSignInVnode) {
		document.getElementById("passcode")?.focus()
	}

	public view(vnode: AppSignInVnode) {

		return (
			<div class="pos-absolute-four-corners bg-stripes flex-center">
				<div class="card padding-lg width-640">
					<div class="align-center text-light-gray margin-vertical" style="font-size:80px;">&nbsp;<i class="bi bi-chat"></i>&nbsp;</div>
					<h1 class="align-center text-xl bold">Conversations Passcode</h1>
					{vnode.state.requestPending ?
						<div class="margin-vertical flex-row">
							<input type="password" class="flex-grow" hint="Conversation Passcode" disabled />
							<button type="submit" class="primary" disabled><span class="spin"><i class="bi bi-arrow-clockwise"></i></span></button>
						</div>
						:
						<form onsubmit={(event: SubmitEvent) => this.submit(vnode, event)}>
							<div class="margin-vertical flex-row">
								<input id="passcode" type="password" class="flex-grow" hint="Conversation Passcode" oninput={(event: Event) => this.setPasscode(vnode, event)} value={vnode.state.passcode} autocomplete="off" />
								<button type="submit" class="primary" tabIndex="0"><i class="bi bi-arrow-right"></i></button>
							</div>
						</form>
					}
					{vnode.state.message && <p class="text-red margin-vertical">{vnode.state.message}</p>}
					<p class="margin-vertical">To view private conversations on this device, you need to enter the passcode you used when you first set up Conversations.</p>
					<p class="margin-vertical">You can <span class="link" tabIndex="0" onclick={() => this.reset(vnode)}>reset your passcode</span> if you don't remember it, but all encrypted messages will be lost.</p>
				</div>
			</div>
		)
	}

	public setPasscode(vnode: AppSignInVnode, event: Event) {
		const input = event.target as HTMLInputElement
		vnode.state.passcode = input.value
	}

	public async submit(vnode: AppSignInVnode, event: Event) {
		vnode.state.requestPending = true
		haltEvent(event)

		const success = await vnode.attrs.controller.signIn(vnode.state.passcode)

		if (!success) {
			vnode.state.passcode = ""
			vnode.state.requestPending = false
			vnode.state.message = "Passcode incorrect. You cannot continue without the valid passcode."
			m.redraw()
			window.requestAnimationFrame(() => {
				document.getElementById("passcode")?.focus()
			})
		}
	}

	public reset(vnode: AppSignInVnode) {

		// Confirm that the user really really wants to wipe their machine.
		if (!confirm("Resetting your passcode will remove all encrypted conversations from this device. Are you sure you want to continue?")) {
			return
		}

		vnode.attrs.controller.eraseDevice()
	}
}

