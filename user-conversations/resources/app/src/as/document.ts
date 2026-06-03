import { ASObject } from "./object"
import { loadActor, loadDocument } from "./loaders"
import * as vocab from "./vocab"

type map = { [key: string]: any }

// Document is a wrapper around a JSON object that provides methods for accessing common ActivityPub properties
export class Document extends ASObject {

	///////////////////////////////////
	// Property accessors

	// attributedTo returns the value of the "attributedTo" property
	attributedTo = async () => {
		const attributedTo = this.get("as", vocab.PropertyAttributedTo)
		return loadActor(attributedTo, this.getProxyUrl())
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
		return loadDocument(this.inReplyToId(), this.getProxyUrl())
	}

	// name returns the value of the "name" property
	name = () => {
		return this.getString("as", vocab.PropertyName)
	}

	published = () => {
		try {
			const value = this.getString("as", vocab.PropertyPublished)
			return Temporal.Instant.from(value)
		} catch (error) {
			console.warn("Unable to parse published date: " + error)
			return Temporal.Instant.from("1970-01-01T00:00:00Z")
		}
	}

	// summary returns the value of the "summary" property
	summary = () => {
		return this.getString("as", vocab.PropertySummary)
	}

	// to returns the value of the "to" property
	to = async () => {
		const result = this.getArray("as", vocab.PropertyTo)
		return Promise.all(result.map(async (actor: any) => loadActor(actor, this.getProxyUrl())))
	}

	///////////////////////////////////
	// MLS-specific properties

	ciphersuite = () => {
		return this.getString("mls", "ciphersuite")
	}

	encoding = () => {
		return this.getString("mls", "encoding")
	}

	// isMLSMessage returns TRUE if this document matches the requirements for being an MLS message
	isMLSMessage = () => {

		if (this.mediaType() != vocab.MediaTypeMLSMessage) {
			return false
		}

		if (this.encoding() != vocab.EncodingTypeBase64) {
			return false
		}

		if (this.content() == "") {
			return false
		}

		return true
	}

	mediaType = () => {
		return this.getString("mls", "mediaType")
	}
}
