export type Config = {
	id: string
	ready: boolean // TRUE when an the user has passed the initial setup screen
	clientName: string // Name of this client/device
	passcode: string // TODO: TEMPORARY: TO BE REMOVED.
	isDesktopNotifications: boolean // TRUE when desktop notifications are enabled
	isHideOnBlur: boolean // TRUE when the app should hide when it loses focus (desktop only)
}

export const ConfigID = "config"

export function NewConfig(): Config {
	return {
		id: ConfigID,
		ready: false,
		clientName: "Unknown Device",
		passcode: "",
		isDesktopNotifications: false,
		isHideOnBlur: false,
	}
}
