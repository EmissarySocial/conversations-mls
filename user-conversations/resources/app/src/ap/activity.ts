import {Object} from "./object"
import {loadDocument} from "./document"
import {loadActor} from "./actor"
import * as vocab from "./vocab"

// Activity is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Activity extends Object {
	//

	///////////////////////////////////
	// Property getters

	// actor returns the value of the "actor" property
	actor = async () => {
		const actor = this.get("as", vocab.PropertyActor)
		return await loadActor(actor)
	}

	actorId = () => {
		return this.getString("as", vocab.PropertyActor)
	}

	// object returns the value of the "object" property, which may be either a string URL or an embedded object
	object = async () => {
		const object = this.get("as", vocab.PropertyObject)
		return await loadDocument(object)
	}

	objectId = () => {
		return this.getString("as", vocab.PropertyObject)
	}

	// target returns the value of the "target" property
	target = async () => {
		const target = await this.get("as", vocab.PropertyTarget)
		return await loadDocument(target)
	}

	// to returns the value of the "to" property
	to = async () => {
		const result = await this.getArray("as", vocab.PropertyTo)
		return result.map(async (actor: any) => await loadActor(actor))
	}

	///////////////////////////////////
	// Property setters

	setObject = (object: Object) => {
		this.set(vocab.PropertyObject, object.toObject())
	}

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
