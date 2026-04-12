import { newId } from "./utils"

export type Config = {
	id: string
	generatorId: string
	generatorName: string // Name of this client/device
	encryptionKeyIV: Uint8Array // Initialization vector for the encryption key
	encryptionKey: string // Encrypted value of the encryption key, used to encrypt messages at rest on this device.
	lastMessageId: string
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
		encryptionKeyIV: new Uint8Array(),
		encryptionKey: "",
		lastMessageId: "",
		isEncryptedMessages: false,
		isDesktopNotifications: false,
		isHideOnBlur: false,
		ready: false,
	}
}
