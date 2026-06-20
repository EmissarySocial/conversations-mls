import { Actor } from "./actor"
import { ASObject } from "./object"
import { Document } from "./document"
import { newId } from "../service/utils"
import * as vocab from "./vocab"
import { loadActivity, loadActor, loadDocument } from "./loaders"

// Activity is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
// https://www.w3.org/TR/activitystreams-vocabulary/#activity-types
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
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-actor
	actorId = () => {
		return this.getString("as", vocab.PropertyActor)
	}

	// actor returns the value of the "actor" property
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-actor
	actor = async () => {
		const actor = this.get("as", vocab.PropertyActor)
		return loadActor(actor)
	}

	// content returns the string value of the "content" property.
	// Rarely used in activities, except for "Like" activities with emoji content.
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-content
	content = () => {
		return this.getString("as", "content")
	}

	// context returns the message context (not @context) property for this activity
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-context
	context = () => {
		return this.getString("as", vocab.PropertyContext)
	}

	// instrument returns the string value of the "instrument" property
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-instrument
	instrument = () => {
		return this.getString("as", vocab.PropertyInstrument)
	}

	// objectId returns the string value of the "object" property (which may be a URL or an embedded object)
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	objectId = () => {
		return this.getString("as", vocab.PropertyObject)
	}

	// object returns the value of the "object" property, which may be either a string URL or an embedded object
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	object = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return loadDocument(object, this.getProxyUrl())
	}

	// objectAsActivity returns the value of the "object" property as an Activity-typed object.
	// this is useful for "Undo" activities, whose "object" is itself an activity that should be undone.
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	objectAsActivity = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return loadActivity(object, this.getProxyUrl())
	}

	// objectAsDocument returns the value of the "object" property as a Document.
	// It DOES NOT trigger a network fetch if the object is only a string ID, so it is useful in synchronous code.
	objectAsDocument = () => {
		return new Document(this.objectAsMap())
	}

	// objectAsMap returns the value of the "object" property as a map.
	// It does NOT load objectIds from the network, so is it useful in synchronous code.
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	objectAsMap = () => {
		return this.getMap("as", vocab.PropertyObject)
	}

	// target loads the document provided in the "target" property
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-target
	target = async () => {
		const target = this.get("as", vocab.PropertyTarget)
		return loadDocument(target, this.getProxyUrl())
	}

	// to returns an array of Actors identified in the "to" property
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-to
	to = async (): Promise<Actor[]> => {
		const result = this.getArray("as", vocab.PropertyTo)
		return Promise.all(result.map(async (actor: any) => await loadActor(actor, this.getProxyUrl())))
	}

	// recipients returns an array of Actors identified in the "to" and "cc" properties, excluding public recipients
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-recipients
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
	///////////////////////////////////

	// setContext sets the context property (NOT @context) of this Activity
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-context
	setContext = (context: string) => {
		this.set(vocab.PropertyContext, context)
	}

	// setObject sets the object property of this Activity
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	setObject = (object: ASObject) => {
		this.set(vocab.PropertyObject, object.toObject())
	}

	// setObjectId sets the object property of this Activity as a string ID (instead of an embedded object)
	// https://www.w3.org/TR/activitystreams-vocabulary/#dfn-object
	setObjectId = (id: string) => {
		this.set(vocab.PropertyObject, id)
	}


	///////////////////////////////////
	// Special calculations
	///////////////////////////////////

	isMlsActivity = (): boolean => {

		// MLS activities MUST be "Create" activities, so if this isn't a Create, then it can't be an MLS activity.
		if (this.type() != vocab.ActivityTypeCreate) {
			return false
		}

		// Next, get the object directly (MLS objects are always embedded, so we don't need to trigger a network fetch)
		const object = this.objectAsDocument()
		return object.isMlsDocument()
	}

	// calcGroupId looks for the groupId FIRST in the activity's `context` property,
	// then falls through to inspecting the object's `context` property.
	calcGroupId = async (): Promise<string> => {

		// First, try to find the context/groupId from the activity itself
		let groupId = this.context()

		if (groupId != "") {
			return groupId
		}

		// Special case for "Undo" - the "object" property is another activity.
		if (this.type() == vocab.ActivityTypeUndo) {
			const undoneActivity = await this.objectAsActivity()
			return undoneActivity.calcGroupId()
		}

		// Last, look for context/groupId in the "object" property (should be a "Document" type)
		const object = await this.object()
		return object.context()
	}
}
