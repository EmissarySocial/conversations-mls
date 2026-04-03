/*
export async function encryptKeyWithPasscode(key: CryptoKey, passcodeKey: CryptoKey, salt: Uint8Array) {

	window.crypto.subtle.encrypt()
}


async function encrypt(content: string, key: CryptoKey) {
	const salt = crypto.getRandomValues(new Uint8Array(16));

	const iv = crypto.getRandomValues(new Uint8Array(12));

	const contentBytes = stringToBytes(content);

	const cipher = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, contentBytes)
	);

	return {
		salt: bytesToBase64(salt),
		iv: bytesToBase64(iv),
		cipher: bytesToBase64(cipher),
	};
}
*/

export async function generateAESKey() {
	return await window.crypto.subtle.generateKey(
		{
			name: "AES-GCM",
			length: 256,
		},
		true,
		["encrypt", "decrypt"]
	);
}


export async function deriveKeyFromPassword(password: string, salt: ArrayBuffer): Promise<CryptoKey> {

	const baseKey = await window.crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveKey"]
	);

	return await window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256"
		},
		baseKey,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"]
	);
}

export async function encodeKeyToBase64(key: CryptoKey): Promise<string> {
	const exported = await window.crypto.subtle.exportKey("raw", key)
	const keyBytes = new Uint8Array(exported);
	const keyString = String.fromCharCode(...keyBytes);
	const base64Key = btoa(keyString);
	return base64Key;
}

export async function decodeKeyFromBase64(base64Key: string): Promise<CryptoKey> {

	const keyString = atob(base64Key)
	const rawKey = Uint8Array.from(keyString, c => c.charCodeAt(0));
	return window.crypto.subtle.importKey(
		"raw",
		rawKey,
		"AES-GCM",
		true,
		["encrypt", "decrypt"]
	);
}


/*
// conversion helpers

function bytesToString(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

function stringToBytes(str: string) {
	return new TextEncoder().encode(str);
}

function bytesToBase64(arr: Uint8Array) {
	return btoa(Array.from(arr, (b) => String.fromCharCode(b)).join(""));
}

function base64ToBytes(base64: string) {
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
*/