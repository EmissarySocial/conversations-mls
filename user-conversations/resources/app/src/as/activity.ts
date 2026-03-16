import { Object } from "./object"
import { loadDocument } from "./document"
import { loadActor } from "./actor"
import * as vocab from "./vocab"
import { newId } from "../service/utils"

// Activity is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Activity extends Object {

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
		return await loadActor(actor)
	}

	// context returns the message context (not @context) property for this activity
	context = () => {
		return this.getString("as", vocab.PropertyContext)
	}

	// objectId returns the string value of the "object" property (which may be a URL or an embedded object)
	objectId = () => {
		return this.getString("as", vocab.PropertyObject)
	}

	// object returns the value of the "object" property, which may be either a string URL or an embedded object
	object = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return await loadDocument(object)
	}

	// objectAsActivity returns the value of the "object" property as an Activity-typed object.
	// this is useful for "Undo" activities, whose "object" is itself an activity that should be undone.
	objectAsActivity = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return await loadActivity(object)
	}

	// target returns the value of the "target" property
	target = async () => {
		const target = this.get("as", vocab.PropertyTarget)
		return await loadDocument(target)
	}

	// to returns the value of the "to" property
	to = async () => {
		const result = await this.getArray("as", vocab.PropertyTo)
		return result.map(async (actor: any) => await loadActor(actor))
	}

	///////////////////////////////////
	// Property setters

	// setContext sets the context property (NOT @context) of this Activity
	setContext = (context: string) => {
		this.set(vocab.PropertyContext, context)
	}

	// setObject sets the object property of this Activity
	setObject = (object: Object) => {
		this.set(vocab.PropertyObject, object.toObject())
	}

	// setObjectId sets the object property of this Activity as a string ID (instead of an embedded object)
	setObjectId = (id: string) => {
		this.set(vocab.PropertyObject, id)
	}
}

export async function loadActivity(value: any) {
	switch (typeof value) {
		case "string":
			return await new Activity().fromURL(value)

		case "object":
			if (Array.isArray(value)) {
				if (value.length > 0) {
					return new Activity(value[0])
				}
				break
			}

			return new Activity(value)
	}

	return new Activity()
}
