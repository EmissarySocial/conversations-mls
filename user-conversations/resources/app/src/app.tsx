import m from "mithril"

import {Document} from "./ap/document"
import {defaultClientConfig} from "ts-mls/clientConfig.js"
import {type APActor} from "./model/ap-actor"
import {Database, NewIndexedDB} from "./service/database"
import {Delivery} from "./service/delivery"
import {Directory} from "./service/directory"
import {Receiver} from "./service/receiver"
import {loadActivityStream} from "./service/network"
import {Controller} from "./controller"
import {Main} from "./view/main"
import * as ap from "./ap/properties"

// Global controller instance
var controller: Controller

async function startup() {
	// Collect arguments from the DOM
	const root = document.getElementById("mls")!
	const actorID = root.dataset["actor-id"] || ""

	// Verify that the root element exists
	if (root == undefined) {
		throw new Error(`Can't mount Mithril app. Please verify that <div id="mls"> exists.`)
	}

	// Load the actor object from the network
	const actor = await new Document().fromURL(actorID)

	const [messagesCollection, allowPlaintextMessages] = findMessagesCollection(actor)

	if (messagesCollection == "") {
		throw new Error(`Actor does not support MLS API.`)
	}

	// Build dependencies
	const indexedDB = await NewIndexedDB(actorID)
	const database = new Database(indexedDB, defaultClientConfig)
	const delivery = new Delivery(actor.id(), actor.outbox())
	const directory = new Directory(actor.id(), actor.outbox())
	const receiver = new Receiver(actor.id(), messagesCollection)

	// Build the controller
	controller = new Controller(
		actor,
		database,
		delivery,
		directory,
		receiver,
		allowPlaintextMessages,
		defaultClientConfig,
	)

	// Pass the controller to the Main component and mount the main application
	m.mount(root, {view: () => <Main controller={controller} />})
}

function findMessagesCollection(actor: Document): [string, boolean] {
	//
	// First, try using the custom emissary:messages property
	// because it will also give us unencrypted direct messages
	const emissaryMessages = actor.emissaryMessages()

	if (emissaryMessages != "") {
		return [emissaryMessages, true]
	}

	// Otherwise, fall back to the standard mls:messages property,
	// but this only supports encrypted group messages
	const mlsMessages = actor.mlsMessages()

	if (mlsMessages != "") {
		return [mlsMessages, true]
	}

	// Fail by returning "" for the collection URL
	return ["", false]
}

// 3..2..1.. Go!
startup()
