import m from "mithril"

export class AppLoading {

	public view() {

		return (
			<div id="conversations">
				<div id="app-sidebar" class="table no-top-border flex-shrink-0 scroll-vertical" style="width:30%">

					<div>
						<div class="flex-row flex-align-center padding-horizontal">
							<div class="flex-row flex-align-center">
								<div class="width-32 circle" />
								<div class="bold text-lg margin-none">Conversations</div>
							</div>
							<div class="flex-grow"></div>
							<div class="text-lg margin-none text-light-gray">
								<i class="bi bi-plus-circle-fill"></i>
							</div>
						</div>

						<div class="flex-row flex-align-center padding text-sm">
							<div role="input" class="flex-grow flex-row flex-align-center">
								<label class="bi bi-search"></label>
								<input
									id="idSearch"
									type="text"
									placeholder="Search"
									class="flex-grow margin-none padding-none"
									style="border:none; outline:none;"
								/>
							</div>
							<div class="text-lg text-light-gray margin-none clickable" tabindex="0">
								<i class="bi bi-filter-circle"></i>
							</div>
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
