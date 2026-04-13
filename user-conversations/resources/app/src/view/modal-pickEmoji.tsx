import m from "mithril"
import Stream from "mithril/stream"

import { type VnodeDOM } from "mithril"
import { Controller } from "../service/controller"
import { Modal } from "./modal"
import { type Emoji, type EmojiGroup } from "../model/emoji"

type PickEmojiVnode = VnodeDOM<PickEmojiAttrs, PickEmojiState>

interface PickEmojiAttrs {
	controller: Controller
	onselect: (emoji: Emoji) => void
	close: () => void
}

interface PickEmojiState {
	emojiGroups: Stream<EmojiGroup[]>
	recentEmojis: Emoji[]
	searchQuery: string
}

export class PickEmoji {

	oninit(vnode: PickEmojiVnode) {

		vnode.state.recentEmojis = JSON.parse(localStorage.getItem("recentEmojis") || "[]") as Emoji[]
		vnode.state.emojiGroups = Stream([] as EmojiGroup[])

		// Load the emoji list from the JSON file
		fetch("/.templates/user-conversations/resources/emoji/data-by-group.json", { cache: "force-cache" })
			.then(response => response.json())
			.then((emojis: EmojiGroup[]) => {
				vnode.state.emojiGroups(emojis)
				vnode.state.emojiGroups.end(true)
				m.redraw()
			})
	}

	// Focus the search input when the modal opens
	oncreate(vnode: PickEmojiVnode) {
		window.requestAnimationFrame(() => {
			const input = document.getElementById("emoji-search") as HTMLInputElement
			if (input) {
				input.focus()
			}
		})
	}

	view(vnode: PickEmojiVnode) {

		var emojiGroups = vnode.state.emojiGroups()

		if (!vnode.state.emojiGroups.end()) {
			return (
				<Modal close={vnode.attrs.close}>
					<input
						id="emoji-search"
						type="search"
						placeholder="Search..."
						class="margin-bottom">
					</input>

					<div id="emoji-picker">
						Loading...
					</div>
				</Modal >
			)
		}

		var filteredGroups: EmojiGroup[]

		// IF we hav a search query, then filter emojis accordingly.
		if (vnode.state.searchQuery) {

			const query = vnode.state.searchQuery.toLowerCase()

			filteredGroups = emojiGroups.map(group => {
				return {
					name: group.name,
					slug: group.slug,
					emojis: group.emojis.filter(emoji =>
						emoji.name.includes(query)
					)
				}
			})
				// Remove groups that have no matching emojis after filtering
				.filter(group => group.emojis.length > 0)

		} else {
			filteredGroups = emojiGroups
		}

		// Display the emoji picker grid, grouped by category
		return (
			<Modal close={vnode.attrs.close}>

				<input
					id="emoji-search"
					type="search"
					placeholder="Search..."
					class="margin-bottom"
					value={vnode.state.searchQuery}
					oninput={(event: Event) => this.filterEmojis(vnode, event)}>
				</input>

				<div id="emoji-picker">

					{vnode.state.recentEmojis.length > 0 && (
						<div class="emoji-group">
							<div class="emoji-group-title">
								Recently Used
								<span class="link margin-left-xs" tabIndex="0" role="button" onclick={() => this.clearRecentEmojis(vnode)}>clear</span>
							</div>
							<div class="emoji-grid">
								{vnode.state.recentEmojis.map(emoji => (
									<div class="emoji" title={emoji.name} onclick={() => this.select(vnode, emoji)}>{emoji.emoji}</div>
								))}
							</div>
						</div>
					)}

					{filteredGroups.map(emojiGroup => (
						<div class="emoji-group">
							<div class="emoji-group-title">{emojiGroup.name}</div>
							<div class="emoji-grid">
								{emojiGroup.emojis.map(emoji => (
									<div class="emoji" title={emoji.name} onclick={() => this.select(vnode, emoji)}>{emoji.emoji}</div>
								))}
							</div>
						</div>
					))}
				</div>
			</Modal>
		)
	}

	filterEmojis(vnode: PickEmojiVnode, event: Event) {
		vnode.state.searchQuery = (event.target as HTMLInputElement).value.toLowerCase()
	}

	select(vnode: PickEmojiVnode, emoji: Emoji) {

		// Save emoji to "recently used" list in localStorage
		var recentEmojis = vnode.state.recentEmojis

		// Add the emoji to the beginning of the array, and remove duplicates
		recentEmojis = [emoji, ...recentEmojis.filter(e => e.emoji !== emoji.emoji)]

		// Limit the list to the 10 most recent emojis
		recentEmojis = recentEmojis.slice(0, 10)

		// Save the updated list back to localStorage
		localStorage.setItem("recentEmojis", JSON.stringify(recentEmojis))

		// Trigger the onselect callback and close
		vnode.attrs.onselect(emoji)
		this.close(vnode)
	}

	clearRecentEmojis(vnode: PickEmojiVnode) {
		vnode.state.recentEmojis = []
		localStorage.removeItem("recentEmojis")
	}

	close(vnode: PickEmojiVnode) {
		vnode.attrs.close()
	}
}
