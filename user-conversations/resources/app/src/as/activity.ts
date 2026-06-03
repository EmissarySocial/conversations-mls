import { Actor } from "./actor"
import { ASObject } from "./object"
import { newId } from "../service/utils"
import * as vocab from "./vocab"
import { loadActivity, loadActor, loadDocument } from "./loaders"

// Activity is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Activity extends ASObject {

	constructor(value?: { [key: string]: any }) {
		super(value)

		if (this.get("as", "id") == undefined) {
			this.set("id", newId())
		}
	}

	///////////////////////////////////
	// Property getters
	///////////////////////////////////

	// actorId returns the string value of the "actor" property (which may be a URL or an embedded object)
	actorId = () => {
		return this.getString("as", vocab.PropertyActor)
	}

	// actor returns the value of the "actor" property
	actor = async () => {
		const actor = this.get("as", vocab.PropertyActor)
		return loadActor(actor)
	}

	// content returns the string value of the "content" property.
	// Rarely used, except for "Like" activities with emoji content.
	content = () => {
		return this.getString("as", "content")
	}

	// context returns the message context (not @context) property for this activity
	context = () => {
		return this.getString("as", vocab.PropertyContext)
	}

	instrument = () => {
		return this.getString("as", vocab.PropertyInstrument)
	}

	// objectId returns the string value of the "object" property (which may be a URL or an embedded object)
	objectId = () => {
		return this.getString("as", vocab.PropertyObject)
	}

	// object returns the value of the "object" property, which may be either a string URL or an embedded object
	object = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return loadDocument(object)
	}

	// objectAsActivity returns the value of the "object" property as an Activity-typed object.
	// this is useful for "Undo" activities, whose "object" is itself an activity that should be undone.
	objectAsActivity = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return loadActivity(object)
	}

	// objectAsMap returns the value of the "object" property as a map.
	// It does NOT load objectIds from the network, so is it useful in synchronous code.
	objectAsMap = () => {
		return this.getMap("as", vocab.PropertyObject)
	}

	// target returns the value of the "target" property
	target = async () => {
		const target = this.get("as", vocab.PropertyTarget)
		return loadDocument(target)
	}

	// to returns the value of the "to" property
	to = async (): Promise<Actor[]> => {
		const result = this.getArray("as", vocab.PropertyTo)
		return Promise.all(result.map(async (actor: any) => await loadActor(actor)))
	}

	recipients = () => {

		const toRecipients = this.getArray("as", vocab.PropertyTo)
		const ccRecipients = this.getArray("as", vocab.PropertyCc)
		const allRecipients = [...toRecipients, ...ccRecipients]

		const filteredRecipients = allRecipients
			.filter(recipient => typeof recipient === "string")
			.filter(recipient => recipient != "https://www.w3.org/ns/activitystreams#Public")
			.filter(recipient => recipient != "as:Public")
			.filter(recipient => recipient != "Public")

		return filteredRecipients
	}

	///////////////////////////////////
	// Property setters

	// setContext sets the context property (NOT @context) of this Activity
	setContext = (context: string) => {
		this.set(vocab.PropertyContext, context)
	}

	// setObject sets the object property of this Activity
	setObject = (object: ASObject) => {
		this.set(vocab.PropertyObject, object.toObject())
	}

	// setObjectId sets the object property of this Activity as a string ID (instead of an embedded object)
	setObjectId = (id: string) => {
		this.set(vocab.PropertyObject, id)
	}
}
