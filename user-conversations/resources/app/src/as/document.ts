import { loadActor } from "./actor"
import { Object } from "./object"
import * as vocab from "./vocab"

type map = { [key: string]: any }

// Document is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Document extends Object {

	///////////////////////////////////
	// Property accessors

	// attributedTo returns the value of the "attributedTo" property
	attributedTo = async () => {
		const attributedTo = this.get("as", vocab.PropertyAttributedTo)
		return await loadActor(attributedTo)
	}

	// attributedToId returns the string/id value of the "attributedTo" property
	attributedToId = () => {
		return this.getString("as", vocab.PropertyAttributedTo)
	}

	attachment = () => {
		return this.getString("as", vocab.PropertyAttachment)
	}

	// content returns the value of the "content" property
	content = () => {
		return this.getString("as", vocab.PropertyContent)
	}

	generator = () => {
		return this.getString("as", vocab.PropertyGenerator)
	}

	// icon returns the value of the "icon" property
	icon = () => {
		return this.getString("as", vocab.PropertyIcon)
	}

	// inReplyTo returns the string/id value of the "inReplyTo" property
	inReplyToId = () => {
		return this.getString("as", vocab.PropertyInReplyTo)
	}

	// inReplyTo returns the value of the "inReplyTo" property
	inReplyTo = () => {
		const inReplyTo = this.get("as", vocab.PropertyInReplyTo)
		return loadDocument(inReplyTo)
	}

	// name returns the value of the "name" property
	name = () => {
		return this.getString("as", vocab.PropertyName)
	}

	// summary returns the value of the "summary" property
	summary = () => {
		return this.getString("as", vocab.PropertySummary)
	}

	// to returns the value of the "to" property
	to = async () => {
		const result = await this.getArray("as", vocab.PropertyTo)
		return result.map(async (actor: any) => await loadActor(actor))
	}

	///////////////////////////////////
	// MLS-specific properties

	encoding = () => {
		return this.getString("mls", "encoding")
	}

	// isMLSMessage returns TRUE if this document matches the requirements for being an MLS message
	isMLSMessage = () => {
		if (this.mediaType() == vocab.MediaTypeMLSMessage) {
			if (this.encoding() == vocab.EncodingTypeBase64) {
				if (this.content() != "") {
					return true
				}
			}
		}

		return false
	}

	mediaType = () => {
		return this.getString("mls", "mediaType")
	}
}

export async function loadDocument(value: any): Promise<Document> {
	switch (typeof value) {
		case "string":
			if (value.startsWith("http://") || value.startsWith("https://")) {
				return await new Document().fromURL(value)
			}
			return new Document()

		case "object":
			if (Array.isArray(value)) {
				if (value.length > 0) {
					return await loadDocument(value[0])
				}
				return new Document()
			}

			return new Document(value)
	}

	return new Document()
}
