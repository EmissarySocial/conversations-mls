import m from "mithril"
import { type VnodeDOM } from "mithril"
import { Actor } from "../as/actor"
import { keyCode } from "./utils"
import type { Controller } from "../service/controller"
import type { KeyPackage } from "ts-mls"

type ActorSearchVnode = VnodeDOM<ActorSearchAttrs, ActorSearchState>

interface ActorSearchAttrs {
	controller: Controller
	name: string
	value: Actor[]
	endpoint: string
	position?: string
	onselect: (actors: Actor[], canBeEncrypted: boolean) => void
}

interface ActorSearchState {
	search: string
	loading: boolean
	actors: Actor[]
	keyPackages: { [key: string]: KeyPackage[] }
	highlightedOption: number
	encrypted: boolean
}

export class ActorSearch {

	oninit(vnode: ActorSearchVnode) {
		vnode.state.search = ""
		vnode.state.loading = false
		vnode.state.actors = []
		vnode.state.keyPackages = {}
		vnode.state.highlightedOption = -1
	}

	view(vnode: ActorSearchVnode) {

		return (
			<div class="autocomplete">
				<div class="input">
					{vnode.attrs.value.map((actor, index) => {
						const isSecure = (vnode.state.keyPackages[actor.id()] != undefined)
						return (
							<span class={isSecure ? "blue tag" : "gray tag"}>
								<span class="flex-row flex-align-center">
									<img src={actor.icon()} class="circle" style="height:1em;" />
									<span class="bold">{actor.name()}</span>
									<i class="margin-left-sm clickable bi bi-x-lg" onclick={() => this.removeActor(vnode, index)}></i>
								</span>
							</span>
						)
					})}
					<input
						id="idActorSearch"
						name={vnode.attrs.name}
						class="padding-none"
						style="min-width:200px;"
						value={vnode.state.search}
						tabindex="0"
						onkeydown={async (event: KeyboardEvent) => {
							this.onkeydown(event, vnode)
						}}
						onkeypress={async (event: KeyboardEvent) => {
							this.onkeypress(event, vnode)
						}}
						oninput={async (event: KeyboardEvent) => {
							this.oninput(event, vnode)
						}}
						onfocus={() => this.loadOptions(vnode)}
						onblur={() => this.onblur(vnode)}></input>
				</div>
				{vnode.state.actors.length ? (
					<div class="options" style={`position:${vnode.attrs.position || "absolute"};`}>
						<div role="menu" class="menu">
							{vnode.state.actors.map((actor, index) => {
								return (
									<div
										role="menuitem"
										class="flex-row padding-xs"
										onmousedown={() => this.selectActor(vnode, index)}
										aria-selected={index == vnode.state.highlightedOption ? "true" : null}>
										<div class="width-32">
											<img src={actor.icon()} class="width-32 circle" />
										</div>
										<div>
											<div>{actor.name()}</div>
											<div class="margin-none text-xs text-light-gray">{actor.computedUsername()}</div>
										</div>
									</div>
								)
							})}
						</div>
					</div>
				) : null}
			</div>
		)
	}

	async onkeydown(event: KeyboardEvent, vnode: ActorSearchVnode) {

		switch (keyCode(event)) {
			case "Backspace":
				const target = event.target as HTMLInputElement

				if (target?.selectionStart == 0) {
					this.removeActor(vnode, vnode.attrs.value.length - 1)
					event.stopPropagation()
				}
				return

			case "ArrowDown":
				vnode.state.highlightedOption = Math.min(vnode.state.highlightedOption + 1, vnode.state.actors.length - 1)
				return

			case "ArrowUp":
				vnode.state.highlightedOption = Math.max(vnode.state.highlightedOption - 1, 0)
				return

			case "Enter":
				this.selectActor(vnode, vnode.state.highlightedOption)
				return
		}
	}

	// These event handlers prevent default behavior for certain control keys
	async onkeypress(event: KeyboardEvent, vnode: ActorSearchVnode) {
		switch (keyCode(event)) {
			case "ArrowDown":
			case "ArrowUp":
			case "Enter":
				event.stopPropagation()
				event.preventDefault()
				return

			case "Escape":
				if (vnode.state.actors.length > 0) {
					vnode.state.actors = []
				}
				event.stopPropagation()
				event.preventDefault()
				return
		}
	}

	async oninput(event: KeyboardEvent, vnode: ActorSearchVnode) {
		const target = event.target as HTMLInputElement
		vnode.state.search = target.value
		this.loadOptions(vnode)
	}

	async loadOptions(vnode: ActorSearchVnode) {
		if (vnode.state.search == "") {
			vnode.state.actors = []
			vnode.state.highlightedOption = -1
			return
		}

		vnode.state.loading = true
		m.redraw()

		const actors: Object[] = await m.request(vnode.attrs.endpoint + "?q=" + vnode.state.search)
		vnode.state.actors = actors.map(object => new Actor(object))

		vnode.state.loading = false
		vnode.state.highlightedOption = -1
	}

	onblur(vnode: ActorSearchVnode) {
		requestAnimationFrame(() => {
			vnode.state.actors = []
			vnode.state.highlightedOption = -1
			m.redraw()
		})
	}

	selectActor(vnode: ActorSearchVnode, index: number) {
		const selected = vnode.state.actors[index]

		if (selected == null) {
			return
		}

		// Add the actor to the selected list and clear the search results
		vnode.attrs.value.push(selected)
		vnode.state.actors = []
		vnode.state.search = ""
		vnode.state.highlightedOption = -1
		this.notifyParent(vnode)

		// Load KeyPackages AFTER selecting the actor from the search results
		this.loadKeyPackages(vnode, selected)
	}

	// (async) Maintains a cache that counts the keyPackages for each actor
	async loadKeyPackages(vnode: ActorSearchVnode, actor: Actor) {

		// See if we already have keyPackages for this actor in the cache
		if (vnode.state.keyPackages[actor.id()] != undefined) {
			return
		}

		// Load the actor's keyPackages collection
		const keyPackages = await vnode.attrs.controller.loadActorKeyPackages(actor.id())

		// Remove KeyPackages that can't be found
		if ((vnode.state.keyPackages == undefined) || (keyPackages.length == 0)) {
			delete vnode.state.keyPackages[actor.id()]
			this.notifyParent(vnode)
			return
		}

		// Otherwise, add keyPackes to the widget's cache
		vnode.state.keyPackages[actor.id()] = keyPackages
		this.notifyParent(vnode)
	}

	allActorsHaveKeyPackages(vnode: ActorSearchVnode): boolean {
		for (const actor of vnode.attrs.value) {
			if (!this.isActorMLS(vnode, actor.id())) {
				return false
			}
		}

		return true
	}

	isActorMLS(vnode: ActorSearchVnode, actorId: string): boolean {
		const keyPackages = vnode.state.keyPackages[actorId]

		if (keyPackages == undefined) {
			return false
		}

		return (keyPackages.length > 0)
	}

	removeActor(vnode: ActorSearchVnode, index: number) {
		vnode.attrs.value.splice(index, 1)
		this.notifyParent(vnode)
		requestAnimationFrame(() => document.getElementById("idActorSearch")?.focus())
		vnode.state.highlightedOption = -1
	}

	notifyParent(vnode: ActorSearchVnode) {
		vnode.attrs.onselect(vnode.attrs.value, this.allActorsHaveKeyPackages(vnode))
	}
}

