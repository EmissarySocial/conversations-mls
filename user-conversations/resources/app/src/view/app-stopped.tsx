import m from "mithril"
import { type Vnode } from "mithril"



type AppStoppedVnode = Vnode<AppStoppedArgs, AppStoppedState>

interface AppStoppedArgs {
	message: string
}

interface AppStoppedState { }

export class AppStopped {

	public view(vnode: AppStoppedVnode) {

		return (
			<div class="pos-absolute-four-corners bg-stripes flex-center">
				<div class="card padding-xl width-512 align-center">
					{this.message(vnode)}
				</div>
			</div>
		)
	}

	message(vnode: AppStoppedVnode) {

		switch (vnode.attrs.message) {

			case "COOKIES-CHANGED":
				return <div>
					<h2><i class="bi bi-slash-circle"></i> Application Stopped</h2>
					It looks like you have signed in to a different account using another tab.
					To return to conversations, you must <span role="link" class="link" onclick={() => location.reload()}>reload this page</span>.
				</div>

			case "SERVER-DOWN":
				return <div>
					<h2><i class="bi bi-exclamation-diamond"></i> Cannot Reach Server</h2>
					Unable to reach the server and authenticate your session.
					To continue with conversations, you must <span role="link" class="link" onclick={() => location.reload()}>reload this page</span>.
				</div>

			case "SIGN-OUT":
				return <div>
					<h2><i class="bi bi-slash-circle"></i> Signed Out</h2>
					<span role="link" class="link" onclick={() => location.reload()}>Reload this page</span> to return to conversations.
				</div>

			case "UNSUPPORTED":
				return <div>
					<h2><i class="bi bi-exclamation-diamond"></i> Unsupported Account</h2>
					It looks like your account doesn't support the required APIs for conversations.
					To return to conversations, you must <span role="link" class="link" onclick={() => location.reload()}>reload this page</span>.
				</div>

			default:
				return <div>
					<h2><i class="bi bi-question-octagon"></i> Unknown Error: {vnode.attrs.message}</h2>
					An unrecognized error occurred.
					To return to conversations, you must <span role="link" class="link" onclick={() => location.reload()}>reload this page</span>.
				</div>
		}
	}
}

