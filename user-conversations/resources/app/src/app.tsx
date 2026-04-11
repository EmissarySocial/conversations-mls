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

// Global controller instance
var controller: Controller

// startup initializes the application and mounts the Mithril components.
async function startup() {

	// Collect arguments from the DOM
	const root = document.getElementById("mls")!
	const actorID = root.dataset["actor-id"] || ""

	// Verify that the root element exists
	if (root == undefined) {
		throw new Error(`Can't mount Mithril app. Please verify that <div id="mls"> exists.`)
	}

	// Build dependencies
	const indexedDB = await NewIndexedDB(actorID)
	const contacts = new Contacts()
	const database = new Database(indexedDB)
	const delivery = new Delivery()
	const directory = new Directory()
	const receiver = new Receiver()

	// Build the controller
	controller = new Controller(actorID, contacts, database, delivery, directory, receiver)

	// Pass the controller to the App component and mount the main application
	m.mount(root, { view: () => <App controller={controller} /> })
}

// 3..2..1.. Go!
startup()
