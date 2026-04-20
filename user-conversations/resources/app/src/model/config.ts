import { newId } from "./utils"

export type Config = {
	id: string
	generatorId: string
	generatorName: string // Name of this client/device
	lastMessageId: string // ID of the last message received. Used to query the server for *only* new messages.
	encryptionKey: ArrayBuffer // Encrypted value of the encryption key, used to encrypt messages at rest on this device.
	encryptionKeyIV: Uint8Array // Initialization vector for the encryption key
	encryptionKeySalt: Uint8Array // Salt for the encryption key
	isEncryptedMessages: boolean // TRUE when the user wants to send encrypted messages when possible
	isDesktopNotifications: boolean // TRUE when desktop notifications are enabled
	isHideOnBlur: boolean // TRUE when the app should hide when it loses focus (desktop only)
	ready: boolean // TRUE when an the user has passed the initial setup screen
}

export const ConfigID = "config"

export function NewConfig(): Config {
	return {
		id: ConfigID,
		generatorId: newId(),
		generatorName: "Unknown Device",
		encryptionKey: new ArrayBuffer(0),
		encryptionKeyIV: new Uint8Array(),
		encryptionKeySalt: new Uint8Array(),
		lastMessageId: "",
		isEncryptedMessages: false,
		isDesktopNotifications: false,
		isHideOnBlur: false,
		ready: false,
	}
}
