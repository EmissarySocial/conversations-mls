import m, { type Vnode } from "mithril"

type SavedNoticeVnode = Vnode<SavedNoticeArgs, SavedNoticeState>

interface SavedNoticeArgs {
	saved: boolean
}

interface SavedNoticeState { }

// SavedNotice is a reusable "✓ Changes saved" confirmation that fades in when its
// `saved` attribute becomes true and fades out when it becomes false. The element
// stays mounted at all times so the fade-out transition can play; visibility is
// driven entirely by the `.visible` CSS class (see .saved-notice in the stylesheet).
export class SavedNotice {

	view(vnode: SavedNoticeVnode): m.Children {

		const saved = vnode.attrs.saved
		const cssClass = "saved-notice" + (saved ? " visible" : "")

		return (
			<span class={cssClass} aria-hidden={saved ? "false" : "true"}>
				<i class="bi bi-check"></i> Changes saved
			</span>
		)
	}
}
