import m from "mithril"

// savedNotice renders the transient "Change is saved" confirmation that appears
// to the right of the Save / Cancel buttons after a successful save.
export function savedNotice(saved: boolean): m.Children {

	if (!saved) {
		return null
	}

	return (
		<span class="margin-left-sm" style="color:var(--green70)">
			<i class="bi bi-check"></i> Changes saved
		</span>
	)
}
