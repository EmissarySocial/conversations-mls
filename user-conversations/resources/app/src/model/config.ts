export type Config = {
	id: string
	ready: boolean // TRUE when an the user has passed the initial setup screen
	clientName: string // Name of this client/device
	passcode: string // TODO: TEMPORARY: TO BE REMOVED.
	isDesktopNotifications: boolean // TRUE when desktop notifications are enabled
	isNotificationSounds: boolean // TRUE when notification sounds are enabled
}

export const ConfigID = "config"

export function NewConfig(): Config {
	return {
		id: ConfigID,
		ready: false,
		passcode: "",
		isDesktopNotifications: false,
		isNotificationSounds: false,
		clientName: "Unknown Device",
	}
}
