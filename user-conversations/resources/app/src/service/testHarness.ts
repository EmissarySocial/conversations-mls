// testHarness.ts
//
// Reusable helpers for controller-level integration tests. Provides an in-memory
// fake IDatabase and a makeController() factory that wires up no-op stubs for the
// dependencies a given test doesn't care about. Intended for tests only.

import Stream from "mithril/stream"

import { Controller } from "./controller"
import type {
	IContacts, IDatabase, IDelivery, IDirectory, IHost, IProxy, IReceiver,
} from "./interfaces"

import { type Config, NewConfig } from "../model/config"
import { type Contact, NewContact } from "../model/contact"
import { type Filter } from "../model/filter"
import { type Group, type EncryptedGroup, type GroupState } from "../model/group"
import { type Message } from "../model/message"
import { type DBKeyPackage } from "../model/db-keypackage"

// FakeDatabase is an in-memory IDatabase backed by plain Maps. The saveMessage and
// saveGroup methods record every call so tests can assert on what the controller
// persisted (e.g. that inbound message content was sanitized before saving).
export class FakeDatabase implements IDatabase {

	groups = new Map<string, Group | EncryptedGroup>()
	messages = new Map<string, Message>()
	filters = new Map<string, Filter>()

	// Call logs for assertions
	savedMessages: Message[] = []
	savedGroups: (Group | EncryptedGroup)[] = []

	#onchangeHandler: () => void = () => { }

	// Lifecycle
	stop(): void { }
	erase(): void { }

	// Config
	async loadConfig(): Promise<Config> { return NewConfig() }
	async saveConfig(_config: Config): Promise<void> { }

	// Groups
	async allGroups(): Promise<(Group | EncryptedGroup)[]> { return [...this.groups.values()] }
	async searchGroups(_tags: string[], _stateIds?: GroupState[]): Promise<Group[]> {
		return [...this.groups.values()] as Group[]
	}
	async loadGroup(groupId: string): Promise<Group | EncryptedGroup | undefined> {
		return this.groups.get(groupId)
	}
	async saveGroup(group: Group): Promise<void> {
		this.groups.set(group.id, group)
		this.savedGroups.push(group)
	}
	async deleteGroup(groupId: string): Promise<void> { this.groups.delete(groupId) }

	// Filters
	async allFilters(): Promise<Filter[]> { return [...this.filters.values()] }
	async loadFilter(filterId: string): Promise<Filter | undefined> { return this.filters.get(filterId) }
	async saveFilter(filter: Filter): Promise<void> { this.filters.set(filter.id, filter) }
	async deleteFilter(filterId: string): Promise<void> { this.filters.delete(filterId) }

	// KeyPackages
	async loadKeyPackage(): Promise<DBKeyPackage | undefined> { return undefined }
	async saveKeyPackage(dbKeyPackage: DBKeyPackage): Promise<DBKeyPackage> { return dbKeyPackage }
	async deleteKeyPackage(): Promise<void> { }

	// Messages
	async allMessages(groupId: string): Promise<Message[]> {
		return [...this.messages.values()].filter(message => message.groupId == groupId)
	}
	async getFirstMessageInGroup(groupId: string): Promise<Message | undefined> {
		return [...this.messages.values()].find(message => message.groupId == groupId)
	}
	async loadMessage(messageId: string): Promise<Message> {
		return this.messages.get(messageId) as Message
	}
	async saveMessage(message: Message): Promise<void> {
		this.messages.set(message.id, message)
		this.savedMessages.push(message)
	}
	async deleteMessage(messageId: string): Promise<void> { this.messages.delete(messageId) }
	async deleteMessagesByGroup(groupId: string): Promise<void> {
		for (const [id, message] of this.messages) {
			if (message.groupId == groupId) { this.messages.delete(id) }
		}
	}

	// Likes
	async likeMessage(): Promise<Message | undefined> { return undefined }
	async undoLikeMessage(): Promise<Message | undefined> { return undefined }

	// Events
	onchange(handler: () => void): void { this.#onchangeHandler = handler }

	// triggerOnchange invokes the registered onchange handler (test convenience)
	triggerOnchange(): void { this.#onchangeHandler() }
}

// makeNoopContacts returns an IContacts stub. getContactStream returns a stream of
// a placeholder contact so the controller's reactive streams initialize cleanly.
function makeNoopContacts(): IContacts {
	return {
		getContactStream: (id: string): Stream<Contact> => Stream(NewContact(id)),
		loadContact: async (_id: string): Promise<Contact | undefined> => undefined,
		saveContact: (_contact: Contact): void => { },
		stop: (): void => { },
	}
}

function makeNoopDelivery(): IDelivery {
	return {
		stop: () => { },
		setActor: () => { },
		setSignout: () => { },
		sendActivity: async (): Promise<string> => "",
	}
}

function makeNoopDirectory(): IDirectory {
	return {
		stop: () => { },
		setActor: () => { },
		getKeyPackagesByActor: (async function* () { })(),
		getKeyPackages: async () => [],
		createKeyPackage: async () => ["", ""],
		updateKeyPackage: async () => { },
		deleteKeyPackage: async () => { },
	} as unknown as IDirectory
}

function makeNoopHost(): IHost {
	return {
		notify: () => { },
		reload: () => { },
		viewActor: () => { },
		viewBlockActor: () => { },
		viewKeyPackages: () => { },
	}
}

function makeNoopProxy(): IProxy {
	return {
		setProxyUrl: () => { },
		Activity: async () => { throw new Error("not implemented in test") },
		Actor: async () => { throw new Error("not implemented in test") },
		Document: async () => { throw new Error("not implemented in test") },
		Collection: async () => { throw new Error("not implemented in test") },
	} as unknown as IProxy
}

function makeNoopReceiver(): IReceiver {
	return {
		setActor: () => { },
		start: () => { },
		stop: () => { },
	}
}

// ControllerOverrides allows a test to substitute any dependency. Anything left
// undefined gets a no-op stub (or, for the database, a fresh FakeDatabase).
export interface ControllerOverrides {
	actorId?: string
	contacts?: IContacts
	database?: IDatabase
	delivery?: IDelivery
	directory?: IDirectory
	proxy?: IProxy
	receiver?: IReceiver
	host?: IHost
}

// makeController constructs a Controller with no-op stubs for every dependency a
// test does not explicitly provide. Returns the controller plus the database it
// was given (a FakeDatabase unless overridden) for convenient assertions.
export function makeController(overrides: ControllerOverrides = {}): { controller: Controller, database: IDatabase } {

	const database = overrides.database ?? new FakeDatabase()

	const controller = new Controller(
		overrides.actorId ?? "https://example.test/users/me",
		overrides.contacts ?? makeNoopContacts(),
		database,
		overrides.delivery ?? makeNoopDelivery(),
		overrides.directory ?? makeNoopDirectory(),
		overrides.proxy ?? makeNoopProxy(),
		overrides.receiver ?? makeNoopReceiver(),
		overrides.host ?? makeNoopHost(),
	)

	return { controller, database }
}
