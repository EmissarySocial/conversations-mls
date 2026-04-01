import m from "mithril"

export class AppStopped {

	public view() {

		return (
			<div class="pos-absolute-four-corners bg-stripes flex-center">
				<div class="card padding-xl width-512 align-center">
					<h2><i class="bi bi-slash-circle"></i> Application Stopped</h2>
					It looks like you have signed in to a different account using another tab.
					To return to conversations, you must <span role="link" class="link" onclick={() => location.reload()}>reload this page</span>.
				</div>
			</div>
		)
	}
}
