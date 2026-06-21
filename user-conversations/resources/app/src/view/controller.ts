// Mithril
import Stream from "mithril/stream"

// ts-mls
import { type KeyPackage } from "ts-mls"

// ActivityPub objects
import { Activity } from "../as/activity"

// Model objects
import { type Config } from "../model/config"
import { type Contact } from "../model/contact"
import { type DBKeyPackage } from "../model/db-keypackage"
import { type Emoji } from "../model/emoji"
import { type EncryptedGroup, type Group, type GroupState } from "../model/group"
import { type Attachment, Message } from "../model/message"
import { type Filter } from "../model/filter"

// The backing service-layer Controller
import { Controller, type SettingsTab } from "../service/controller"

// SettingsTab is re-exported so that view components can keep importing it
// from the view-layer Controller alongside ViewController.
export type { SettingsTab }

// ViewController is the view layer's entry point to the application. For now it is a
// thin façade over the service-layer Controller (`service/controller.ts`): every method
// and property is a pass-through to the backing controller, so behavior is identical.
//
// This seam exists so that UI concerns (page-view state, modals, reply composition, …) can
// be migrated out of the service Controller incrementally, one responsibility at a time,
// without a single high-risk refactor. Until that migration happens, this class deliberately
// adds no behavior of its own.
export class ViewController {

	readonly #controller: Controller

	constructor(controller: Controller) {
		this.#controller = controller
	}

	//////////////////////////////////////////
	// State (delegated to the service Controller)
	//////////////////////////////////////////

	get config(): Config { return this.#controller.config }
	set config(value: Config) { this.#controller.config = value }

	get groups(): Group[] { return this.#controller.groups }
	set groups(value: Group[]) { this.#controller.groups = value }

	get messages(): Message[] { return this.#controller.messages }
	set messages(value: Message[]) { this.#controller.messages = value }

	get filters(): Filter[] { return this.#controller.filters }
	set filters(value: Filter[]) { this.#controller.filters = value }

	get groupStream(): Stream<Group | EncryptedGroup> { return this.#controller.groupStream }
	get groupMemberStream(): Stream<string[]> { return this.#controller.groupMemberStream }
	get groupContactStream(): Stream<Stream<Contact>[]> { return this.#controller.groupContactStream }

	get message(): Message | undefined { return this.#controller.message }
	set message(value: Message | undefined) { this.#controller.message = value }

	get inReplyTo(): Message | undefined { return this.#controller.inReplyTo }
	set inReplyTo(value: Message | undefined) { this.#controller.inReplyTo = value }

	get pageView(): string { return this.#controller.pageView }
	set pageView(value: string) { this.#controller.pageView = value }

	get settingsTab(): SettingsTab { return this.#controller.settingsTab }
	set settingsTab(value: SettingsTab) { this.#controller.settingsTab = value }

	get modalView(): string { return this.#controller.modalView }
	set modalView(value: string) { this.#controller.modalView = value }

	get modalAttachments(): Attachment[] { return this.#controller.modalAttachments }
	get modalAttachmentIndex(): number { return this.#controller.modalAttachmentIndex }

	get isWindowFocused(): boolean { return this.#controller.isWindowFocused }
	set isWindowFocused(value: boolean) { this.#controller.isWindowFocused = value }

	get isApplicationRunning(): boolean { return this.#controller.isApplicationRunning }
	set isApplicationRunning(value: boolean) { this.#controller.isApplicationRunning = value }

	get stopReason(): string { return this.#controller.stopReason }
	set stopReason(value: string) { this.#controller.stopReason = value }

	//////////////////////////////////////////
	// Lifecycle & configuration
	//////////////////////////////////////////

	start = () => this.#controller.start()

	startupConfiguration = (clientName: string, passcode: string, isEncryptedMessages: boolean, isDesktopNotifications: boolean, isHideOnBlur: boolean) =>
		this.#controller.startupConfiguration(clientName, passcode, isEncryptedMessages, isDesktopNotifications, isHideOnBlur)

	saveConfiguration = (clientName: string, passcode: string, isEncryptedMessages: boolean, isDesktopNotifications: boolean, isHideOnBlur: boolean) =>
		this.#controller.saveConfiguration(clientName, passcode, isEncryptedMessages, isDesktopNotifications, isHideOnBlur)

	saveConfig = () => this.#controller.saveConfig()

	signIn = (passcode: string): Promise<boolean> => this.#controller.signIn(passcode)

	stop = (message: string) => this.#controller.stop(message)

	eraseDevice = () => this.#controller.eraseDevice()

	onFocusWindow = () => this.#controller.onFocusWindow()

	onBlurWindow = () => this.#controller.onBlurWindow()

	//////////////////////////////////////////
	// Page & modal navigation
	//////////////////////////////////////////

	page_index = () => this.#controller.page_index()
	page_settings = () => this.#controller.page_settings()
	page_groups = () => this.#controller.page_groups()
	page_group_messages = () => this.#controller.page_group_messages()
	page_group_members = () => this.#controller.page_group_members()
	page_group_notes = () => this.#controller.page_group_notes()
	page_signout = () => this.#controller.page_signout()

	modal_addGroupMember = () => this.#controller.modal_addGroupMember()
	modal_close = () => this.#controller.modal_close()
	modal_newConversation = () => this.#controller.modal_newConversation()
	modal_editMessage = (messageId: string) => this.#controller.modal_editMessage(messageId)
	modal_messageHistory = (messageId: string) => this.#controller.modal_messageHistory(messageId)
	modal_startReaction = (message: Message) => this.#controller.modal_startReaction(message)
	modal_startReaction_callback = (emoji: Emoji) => this.#controller.modal_startReaction_callback(emoji)
	modal_attachments = (message: Message, index: number) => this.#controller.modal_attachments(message, index)

	//////////////////////////////////////////
	// Host integration
	//////////////////////////////////////////

	host_actor = (actorId: string) => this.#controller.host_actor(actorId)
	host_block = (actorId: string) => this.#controller.host_block(actorId)
	host_keyPackages = () => this.#controller.host_keyPackages()

	//////////////////////////////////////////
	// Actor & account
	//////////////////////////////////////////

	actorId = (): string => this.#controller.actorId()
	actorIcon = (): string => this.#controller.actorIcon()
	lastMessage = (messageId?: string): Promise<string> => this.#controller.lastMessage(messageId)
	useEncryptedMessages = (): boolean => this.#controller.useEncryptedMessages()

	//////////////////////////////////////////
	// KeyPackages
	//////////////////////////////////////////

	createOrUpdateKeyPackage = (): Promise<DBKeyPackage> => this.#controller.createOrUpdateKeyPackage()
	loadKeyPackage = (): Promise<DBKeyPackage | undefined> => this.#controller.loadKeyPackage()
	loadOrCreateKeyPackage = (): Promise<DBKeyPackage> => this.#controller.loadOrCreateKeyPackage()
	loadActorKeyPackages = (actorId: string): Promise<KeyPackage[]> => this.#controller.loadActorKeyPackages(actorId)

	//////////////////////////////////////////
	// Groups
	//////////////////////////////////////////

	createGroup = (recipients: string[], initialMessage: string, encrypted: boolean) =>
		this.#controller.createGroup(recipients, initialMessage, encrypted)

	joinGroup = (group: Group) => this.#controller.joinGroup(group)
	loadGroups = () => this.#controller.loadGroups()
	loadFilters = () => this.#controller.loadFilters()
	saveFilter = (filter: Filter) => this.#controller.saveFilter(filter)
	deleteFilter = (filterId: string) => this.#controller.deleteFilter(filterId)
	selectedFilterName = (): string => this.#controller.selectedFilterName()
	setConversationFilter = (filterId: string) => this.#controller.setConversationFilter(filterId)

	saveGroupAndSync = (group: Group) => this.#controller.saveGroupAndSync(group)
	saveGroup = (group: Group) => this.#controller.saveGroup(group)
	syncGroup = (group: Group) => this.#controller.syncGroup(group)
	leaveGroup = (groupId: string) => this.#controller.leaveGroup(groupId)

	selectGroup = (groupId: string) => this.#controller.selectGroup(groupId)
	clearSelectedGroup = () => this.#controller.clearSelectedGroup()
	reconcileSelectedGroup = () => this.#controller.reconcileSelectedGroup()
	selectedGroupId = () => this.#controller.selectedGroupId()
	getFirstMessageInGroup = (groupId: string): Promise<string> => this.#controller.getFirstMessageInGroup(groupId)

	setGroupState = (group: Group, stateId: string) => this.#controller.setGroupState(group, stateId)
	setSelectedGroupState = (stateId: GroupState) => this.#controller.setSelectedGroupState(stateId)

	addGroupMembers = (actorIds: string[]) => this.#controller.addGroupMembers(actorIds)
	removeGroupMember = (actorId: string) => this.#controller.removeGroupMember(actorId)

	//////////////////////////////////////////
	// Messages
	//////////////////////////////////////////

	loadMessages = () => this.#controller.loadMessages()
	loadMessage = (messageId: string) => this.#controller.loadMessage(messageId)
	startReply = (message: Message) => this.#controller.startReply(message)
	removeReply = () => this.#controller.removeReply()
	sendMessage = (content: string, attachments: Attachment[] = []) => this.#controller.sendMessage(content, attachments)
	updateMessage = (message: Message) => this.#controller.updateMessage(message)
	clearMessage = () => this.#controller.clearMessage()
	deleteMessage = (messageId: string) => this.#controller.deleteMessage(messageId)
	reactToMessage = (messageId: string, content: string = "❤️") => this.#controller.reactToMessage(messageId, content)
	undoReaction = (messageId: string) => this.#controller.undoReaction(messageId)

	//////////////////////////////////////////
	// Contacts & inbound activities
	//////////////////////////////////////////

	getContactStream = (actorId: string): Stream<Contact> => this.#controller.getContactStream(actorId)
	receiveActivity = (activity: Activity, retryCount: number = 0): Promise<void> => this.#controller.receiveActivity(activity, retryCount)
}
