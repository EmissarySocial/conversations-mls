import m from "mithril"

// AppLoading renders a static skeleton of the main app shell while the controller and its
// dependencies initialize. Its markup deliberately mirrors `Index` + `Groups` (same
// #app-sidebar container, .conversations-pane / .conversations-scroll structure, header and
// Settings footer) so the transition into the live app is seamless. It makes no controller
// calls, because it renders before the controller is ready — keep it in sync with `Groups`
// whenever the sidebar chrome changes.
export class AppLoading {

	public view() {

		return (
			<div id="conversations">
				<div id="app-sidebar" class="table no-top-border flex-shrink-0">
					<div class="conversations-pane">

						<div class="flex-row flex-align-center padding-left">
							<div class="bold text-lg margin-none flex-grow ellipsis" style="min-width:0">Loading...</div>
							<div class="popup-button" aria-disabled="true" aria-label="Filter conversations">
								<i class="bi bi-filter"></i>
							</div>
							<div class="popup-button primary" aria-disabled="true" aria-label="New conversation">
								<i class="bi bi-plus-lg"></i>
							</div>
						</div>

						<hr class="margin-vertical-sm" />

						<div class="conversations-scroll"></div>

						<hr class="margin-vertical-sm" />

						<div class="sidebar-item flex-row flex-align-center padding-horizontal">
							<i class="bi bi-gear"></i>
							<span>Settings</span>
						</div>

					</div>
				</div>

				<div class="flex-grow align-center padding-xl">
					<div><span class="spin"><i class="bi bi-arrow-repeat"></i></span> Loading...</div>
				</div>
			</div>
		)
	}
}
