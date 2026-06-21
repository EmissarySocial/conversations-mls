import { ASObject } from "./object"
import { loadActor, loadDocument } from "./loaders"
import { type Attachment } from "../model/message"
import { toString } from "./utils"
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

	// attachments returns the document's attachments as a normalized list. It
	// accepts the modern ActivityStreams form (Document/Image/Video/Audio objects
	// carrying url/mediaType/name) as well as legacy bare-string values, and always
	// returns an array even when a single attachment is present.
	attachments = (): Attachment[] => {

		return this.getArray("as", vocab.PropertyAttachment)
			.map(value => parseAttachment(value))
			.filter((attachment): attachment is Attachment => attachment != undefined)
	}

	// content returns the value of the "content" property
	content = () => {
		return this.getString("as", vocab.PropertyContent)
	}

	context = () => {
		return this.getString("as", vocab.PropertyContext)
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

	// isMlsDocument returns TRUE if this document matches the requirements for being an MLS message
	isMlsDocument = () => {

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

// parseAttachment normalizes a single raw "attachment" value into an Attachment.
// It accepts an ActivityStreams object ({type, url, mediaType, name, ...}) or a
// bare URL string, and returns undefined when no usable URL can be found.
function parseAttachment(value: any): Attachment | undefined {

	// Legacy form: the attachment is just a URL (or "data:" URI) string
	if (typeof value == "string") {
		return value == "" ? undefined : { url: value, mediaType: "", name: "", size: 0 }
	}

	// Modern form: the attachment is an ActivityStreams object
	if (value != null && typeof value == "object") {

		const url = toString(value[vocab.PropertyUrl] ?? value[vocab.PropertyHref])

		if (url == "") {
			return undefined
		}

		const attachment: Attachment = {
			url: url,
			mediaType: toString(value[vocab.PropertyMediaType]),
			name: toString(value[vocab.PropertyName]),
			size: 0,
		}

		// width/height are optional and only carried when the sender supplied them
		if (typeof value[vocab.PropertyWidth] == "number") {
			attachment.width = value[vocab.PropertyWidth]
		}

		if (typeof value[vocab.PropertyHeight] == "number") {
			attachment.height = value[vocab.PropertyHeight]
		}

		// blurhash is the Mastodon-compatible blurry placeholder for an image
		const blurhash = toString(value[vocab.PropertyBlurhash])
		if (blurhash != "") {
			attachment.blurhash = blurhash
		}

		return attachment
	}

	return undefined
}
