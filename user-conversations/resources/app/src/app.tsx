import m from "mithril"

// Services
import { Database, NewIndexedDB } from "./service/database"
import { Delivery } from "./service/delivery"
import { Directory } from "./service/directory"
import { Receiver } from "./service/receiver"
import { Controller } from "./service/controller"

// Views
import { App } from "./view/app"
import { Contacts } from "./service/contacts"
import { Host } from "./service/host"

// Global controller instance
var controller: Controller

// startup initializes the application and mounts the Mithril components.
async function startup() {

	// Locate the root DOM element
	const root = document.getElementById("mls")!

	if (root == undefined) {
		throw new Error(`Can't mount Mithril app. Please verify that <div id="mls"> exists.`)
	}

	// Locate the authenticated actor ID
	const actorId = root.dataset["actorId"]

	if (actorId == undefined || actorId == "") {
		throw new Error(`Actor ID not provided. Please set the "data-actor-id" attribute on the root element.`)
	}

	// Build dependencies
	const indexedDB = await NewIndexedDB(actorId)
	const host = new Host()
	const contacts = new Contacts()
	const database = new Database(host, indexedDB)
	const delivery = new Delivery()
	const directory = new Directory(actorId)
	const receiver = new Receiver()

	// Build the controller
	controller = new Controller(actorId, contacts, database, delivery, directory, receiver, host)

	// Pass the controller to the App component and mount the main application
	m.mount(root, { view: () => <App controller={controller} /> })

	window.addEventListener("focus", async () => {
		controller.onFocusWindow()
	})

	window.addEventListener("blur", async () => {
		controller.onBlurWindow()
	})

	// Use the host connector to watch application state (e.g. cookies)
	host.watchSignin((message: string) => controller.stop(message))
}

// 3..2..1.. Go!
startup()
