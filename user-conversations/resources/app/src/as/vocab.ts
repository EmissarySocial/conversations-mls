// Activity types

export const ActivityTypeAccept = "Accept"

export const ActivityTypeCreate = "Create"

export const ActivityTypeDelete = "Delete"

export const ActivityTypeLike = "Like"

export const ActivityTypeUndo = "Undo"

export const ActivityTypeUpdate = "Update"

// Context Values

export const ContextActivityStreams = "https://www.w3.org/ns/activitystreams"

export const ContextMLS = "https://purl.archive.org/socialweb/mls"

export const ContextSSE = "https://purl.archive.org/socialweb/sse"

// Encoding Values

export const EncodingTypeBase64 = "base64"

// MediaType Values

export const MediaTypeMLSMessage = "message/mls"

// Object Types

export const ObjectTypeArticle = "Article"

export const ObjectTypeImage = "Image"

export const ObjectTypeNote = "Note"

export const ObjectTypeMLSPrivateMessage = "mls:PrivateMessage"

// ActivityVocabulary Object Properties

export const PropertyActor = "actor"

export const PropertyAtContext = "@context"

export const PropertyContent = "content"

export const PropertyContext = "context"

export const PropertyId = "id"

export const PropertyObject = "object"

export const PropertyInReplyTo = "inReplyTo"

export const PropertyTarget = "target"

export const PropertyTo = "to"

export const PropertyType = "type"

//// Activities

export type Activity = ActivityAccept | ActivityCreate | ActivityDelete | ActivityLike | ActivityUndo | ActivityUpdate

export type ActivityAccept = {
	actor: string
	type: "Accept"
	object: Activity
}

export type ActivityCreate = {
	actor: string
	type: "Create"
	object: Object
}

export type ActivityDelete = {
	actor: string
	type: "Delete"
	object: string
}

export type ActivityLike = {
	actor: string
	type: "Like"
	object: string
}

export type ActivityUndo = {
	actor: string
	type: "Undo"
	object: Activity
}

export type ActivityUpdate = {
	actor: string
	type: "Update"
	object: Object
}

//// Collections

export type Collection = {
	type: "Collection"
	id: string
	items?: Object[]
	first?: string
	totalItems?: number
}

export type OrderedCollection = {
	type: "OrderedCollection"
	id: string
	orderedItems?: Object[]
	first?: string
	totalItems?: number
}

export type CollectionPage = {
	type: "CollectionPage"
	id: string
	items?: Object[]
	next?: string
}

export type OrderedCollectionPage = {
	type: "OrderedCollectionPage"
	id: string
	orderedItems?: Object[]
	next?: string
}

export type CollectionLike = Collection | OrderedCollection | CollectionPage | OrderedCollectionPage | {}

//// Objects

export type ObjectNote = {
	type: "Note"
	id: string
	content: string
}

export type ObjectArticle = {
	type: "Article"
	id: string
	content: string
}

export type ObjectImage = {
	type: "Image"
	id: string
	url: string
}

export type Object = ObjectNote | ObjectArticle | ObjectImage

//// Complete Actions

export type ActivityCreateNote = ActivityCreate & {
	object: ObjectNote
}

export type ActivityCreateArticle = ActivityCreate & {
	object: ObjectArticle
}

export type ActivityUpdateNote = ActivityUpdate & {
	object: ObjectNote
}

export type ActivityUpdateArticle = ActivityUpdate & {
	object: ObjectArticle
}

export type ActivityDeleteNote = ActivityDelete & {
	object: string
}

export type ActivityDeleteArticle = ActivityDelete & {
	object: string
}
