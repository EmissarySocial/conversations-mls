/******************************************
* Interfaces.ts
* Defines interfaces required by the controller
* and MLS services.
*******************************************/

import Stream from "mithril/stream"

// ts-mls types
import { type MlsFramedMessage, type PrivateKeyPackage } from "ts-mls"
import { type MlsGroupInfo } from "ts-mls"
import { type MlsWelcomeMessage } from "ts-mls"
import { type KeyPackage } from "ts-mls"

// ActivityStreams types
import { type Activity } from "../as/activity"
import { type Actor } from "../as/actor"

// Model types
import { type APKeyPackage } from "../model/ap-keypackage"
import { type Config } from "../model/config"
import { type Contact } from "../model/contact"
import { type Group } from "../model/group"
import { type EncryptedGroup } from "../model/group"
import { type Message } from "../model/message"
import { type DBKeyPackage } from "../model/db-keypackage"

export interface IContacts {
	getContactStream(id: string): Stream<Contact>
	loadContact(id: string): Promise<Contact | undefined>
	saveContact(contact: Contact): void
	stop(): void
}

export interface IController {

	// Lifecycle methods
	stop(message: string): void

	createOrUpdateKeyPackage(): Promise<DBKeyPackage>
}

// IDatabase wraps all of the methods that the MLS service
// uses to store group state.
export interface IDatabase {

	// Lifecycle methods
	stop(): void
	erase(): void

	// Config methods
	loadConfig(): Promise<Config>
	saveConfig(config: Config): Promise<void>

	// Group methods
	allGroups(): Promise<(Group | EncryptedGroup)[]>
	loadGroup(groupId: string): Promise<Group | EncryptedGroup | undefined>
	saveGroup(group: Group): Promise<void>
	deleteGroup(groupId: string): Promise<void>

	// KeyPackage methods
	loadKeyPackage(): Promise<DBKeyPackage | undefined>
	saveKeyPackage(keyPackageId: string, publicPackage: KeyPackage, privatePackage: PrivateKeyPackage): Promise<DBKeyPackage>

	// Message methods
	allMessages(groupId: string): Promise<Message[]>
	loadMessage(messageId: string): Promise<Message>
	saveMessage(message: Message): Promise<void>
	deleteMessage(messageId: string): Promise<void>
	deleteMessagesByGroup(groupId: string): Promise<void>

	// Like/Undo methods
	likeMessage(actorId: string, messageId: string, content: string): Promise<Message | undefined>
	undoLikeMessage(actorId: string, messageId: string): Promise<Message | undefined>

	// other event handlers
	onchange(handler: () => void): void
}

// IDelivery wraps all of the methods that the MLS service
// uses to send messages.
export interface IDelivery {

	// Lifecycle methods
	stop(): void

	// Lifecycle methods
	setActor(actor: Actor): void

	// sendActivity sends a raw ActivityStream activity to the server for delivery.
	sendActivity(activity: Activity | { [key: string]: any }): Promise<Activity>
}

// IDirectory wraps all of the methods that the MLS service
// uses to look up users' KeyPackages.
export interface IDirectory {

	// Lifecycle methods
	stop(): void

	// Lifecycle methods
	setActor(actor: Actor): void
	setGenerator(generatorId: string, generatorName: string): void

	// KeyPackage methods
	getKeyPackages(actorIDs: string[]): Promise<KeyPackage[]>
	createKeyPackage(publicPackage: KeyPackage): Promise<string>
	updateKeyPackage(keyPackageId: string, publicPackage: KeyPackage): Promise<void>
	deleteKeyPackage(keyPackageUrl: string): Promise<void>
}

// IHost wraps methods that integrate with the host application, such as viewing an actor's profile
// or managing keypackages on the serve
export interface IHost {
	reload(): void
	viewActor(actorId: string): void
	viewKeyPackages(): void
}

// IReceiver wraps all of the methods that the Controller uses
// to receive SSE updates.
export interface IReceiver {

	// Lifecycle methods
	setActor(actor: Actor): void
	start(generatorId: string, handler: IActivityHandler, lastMessageGetterSetter: ILastMessageGetterSetter): void
	stop(): void
}

// IActivityHandler is a function that takes an MlsPrivateMessage and returns void.
// The Receiver service will call the registered ActivityHandler when a new message
// is received.
export type IActivityHandler = (activity: Activity) => Promise<void>


// ILastMessageHandler is a function that gets or sets the last message ID.
// The Receiver service will call the registered LastMessageHandler to get the ID
// of the last message received, and to update it when new messages are received.
export type ILastMessageGetterSetter = (messageId?: string) => Promise<string>
