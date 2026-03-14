import m from "mithril"

// ActivityStreams objects
import {Actor} from "./as/actor"

// Services
import {Database, NewIndexedDB} from "./service/database"
import {Delivery} from "./service/delivery"
import {Directory} from "./service/directory"
import {Receiver} from "./service/receiver"
import {Controller} from "./service/controller"

// Views
import {App} from "./view/app"

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

	// Load the actor object from the network and locate their messages collection
	const actor = await new Actor().fromURL(actorID)
	const {url, plaintext} = actor.messages()

	if (url == "") {
		throw new Error(`Actor does not support MLS API.`)
	}

	// Build dependencies
	const indexedDB = await NewIndexedDB(actorID)
	const database = new Database(indexedDB)
	const delivery = new Delivery(actor.id(), actor.outbox())
	const directory = new Directory(actor.id(), actor.outbox())
	const receiver = new Receiver(actor.id(), url)

	// Build the controller
	controller = new Controller(actor, database, delivery, directory, receiver, plaintext)

	// Pass the controller to the App component and mount the main application
	m.mount(root, {view: () => <App controller={controller} />})
}

// 3..2..1.. Go!
startup()
