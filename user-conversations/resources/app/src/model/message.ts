import { newId } from "./utils"

// AttachmentKind is the broad category used to choose how an attachment is
// displayed (thumbnail, player, or download link).
export type AttachmentKind = "image" | "video" | "audio" | "file"

// Attachment describes a single file attached to a Message. The url is either a
// self-contained "data:" URI (for files this client embeds) or a remote URL (for
// received messages). width/height are optional and used only when a remote
// Document supplies them; size is 0 when unknown (e.g. linked, non-embedded files).
// blurhash, when present on an image, is a BlurHash string rendered as a blurry
// placeholder until the full image loads.
export type Attachment = {
	url: string
	mediaType: string
	name: string
	size: number
	width?: number
	height?: number
	blurhash?: string
}

// MessageData represents the raw data structure of a Message
export type MessageData = {
	id: string
	groupId: string
	type: "" | "SENT" | "RECEIVED" | "ADD-ACTOR" | "REMOVE-ACTOR" | "ADD-DEVICE" | "REMOVE-DEVICE"
	sender: string
	inReplyTo: string
	content: string
	attachments: Attachment[]
	reactions: { [key: string]: string[] }
	history: string[]
	received: string[] // List of actor IDs that have received this message
	createDate: number
	updateDate: number
}


// Message represents a single message that has been sent or received in the group conversation.
export class Message {

	// Properties
	id: string = newId()
	groupId: string = ""
	type: "" | "SENT" | "RECEIVED" | "ADD-ACTOR" | "REMOVE-ACTOR" | "ADD-DEVICE" | "REMOVE-DEVICE" = ""
	sender: string = ""
	inReplyTo: string = ""
	content: string = ""
	attachments: Attachment[] = []
	reactions: { [key: string]: string[] } = {}
	history: string[] = []
	received: string[] = [] // List of actor IDs that have received this message
	createDate: number = Date.now()
	updateDate: number = Date.now()

	constructor(data?: Partial<MessageData>) {
		Object.assign(this, data)
	}

	// setReaction adds a unique reaction from the specified actor
	setReaction(actorId: string, reaction: string): boolean {

		this.removeReaction(actorId)

		if (this.reactions[reaction] == undefined) {
			this.reactions[reaction] = []
		}

		this.reactions[reaction].push(actorId)
		return true
	}

	// removeReaction removes a reaction from the specified actor, regardless of the reaction type.
	// Returns TRUE if a reaction was removed, or FALSE if no reaction was found for this actor.
	removeReaction(actorId: string): boolean {

		for (const [existingReaction, actors] of Object.entries(this.reactions)) {

			if (actors.includes(actorId)) {
				this.reactions[existingReaction] = actors.filter(a => a != actorId)

				if (this.reactions[existingReaction].length == 0) {
					delete this.reactions[existingReaction]
				}

				// TRUE means that the message object was changed.
				return true
			}
		}

		// FALSE means that we did not make any changes
		return false
	}
}

export function NewMessage(data?: Partial<MessageData>) {
	return new Message(data)
}

// attachmentKind maps an Attachment's mediaType to the broad category that
// determines how it is displayed. Anything that is not a recognized image,
// video, or audio type is treated as a downloadable "file".
export function attachmentKind(attachment: Attachment): AttachmentKind {

	const mediaType = attachment.mediaType.toLowerCase()

	if (mediaType.startsWith("image/")) {
		return "image"
	}

	if (mediaType.startsWith("video/")) {
		return "video"
	}

	if (mediaType.startsWith("audio/")) {
		return "audio"
	}

	return "file"
}

// attachmentIcon returns the Bootstrap Icons class name that best represents an
// attachment, based on its kind and (for files) its mediaType.
export function attachmentIcon(attachment: Attachment): string {

	switch (attachmentKind(attachment)) {

		case "image":
			return "bi-file-earmark-image"

		case "video":
			return "bi-file-earmark-play"

		case "audio":
			return "bi-file-earmark-music"
	}

	// Refine the generic "file" icon for a few common document types
	const mediaType = attachment.mediaType.toLowerCase()

	if (mediaType == "application/pdf") {
		return "bi-file-earmark-pdf"
	}

	if (mediaType.startsWith("text/")) {
		return "bi-file-earmark-text"
	}

	if (mediaType.includes("zip") || mediaType.includes("compressed")) {
		return "bi-file-earmark-zip"
	}

	return "bi-file-earmark"
}

// legacyAttachmentToAttachment upgrades a single legacy attachment (a bare URL or
// "data:" URI string) into a structured Attachment. For "data:" URIs the size is
// computed from the decoded base64 payload; for linked URLs the size is unknown.
export function legacyAttachmentToAttachment(value: string): Attachment {

	if (value.startsWith("data:")) {
		return dataUriToAttachment(value, "", base64ByteLength(value))
	}

	return { url: value, mediaType: "", name: "", size: 0 }
}

// base64ByteLength returns the decoded byte length of the base64 payload in a
// "data:...;base64,<payload>" URI, or 0 if it is not base64-encoded.
function base64ByteLength(dataUri: string): number {

	const comma = dataUri.indexOf(",")

	if (comma < 0 || !dataUri.slice(0, comma).includes("base64")) {
		return 0
	}

	const payload = dataUri.slice(comma + 1)

	let padding = 0
	if (payload.endsWith("==")) {
		padding = 2
	} else if (payload.endsWith("=")) {
		padding = 1
	}

	return Math.max(0, Math.floor(payload.length * 3 / 4) - padding)
}

// attachmentToDocument converts an Attachment into an ActivityStreams object for
// transmission. The "type" is chosen to match the attachment's kind (Image,
// Video, Audio, or the generic Document), and width/height are included only when
// known.
export function attachmentToDocument(attachment: Attachment): { [key: string]: any } {

	let type = "Document"

	switch (attachmentKind(attachment)) {
		case "image": type = "Image"; break
		case "video": type = "Video"; break
		case "audio": type = "Audio"; break
	}

	const document: { [key: string]: any } = {
		type: type,
		mediaType: attachment.mediaType,
		url: attachment.url,
		name: attachment.name,
	}

	if (attachment.width != undefined) {
		document["width"] = attachment.width
	}

	if (attachment.height != undefined) {
		document["height"] = attachment.height
	}

	if (attachment.blurhash != undefined) {
		document["blurhash"] = attachment.blurhash
	}

	return document
}

// dataUriToAttachment builds an Attachment from a "data:" URI produced by a
// FileReader, deriving the mediaType from the URI and the byte size from the
// decoded buffer length.
export function dataUriToAttachment(dataUri: string, name: string, size: number): Attachment {

	// Parse the mediaType out of the "data:<mediaType>;base64,..." prefix
	const match = /^data:([^;,]*)[;,]/.exec(dataUri)
	const mediaType = match?.[1] ?? ""

	return { url: dataUri, mediaType, name, size }
}