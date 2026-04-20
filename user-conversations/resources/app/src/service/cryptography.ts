import { type CiphersuiteName } from "ts-mls"
import { type CiphersuiteImpl } from "ts-mls"
import { type Credential } from "ts-mls"
import { type KeyPackage } from "ts-mls"
import { type PrivateKeyPackage } from "ts-mls"

import { getCiphersuiteImpl } from "ts-mls"
import { defaultCredentialTypes } from "ts-mls"
import { defaultLifetime } from "ts-mls"
import { generateKeyPackage } from "ts-mls"

// cipherSuiteImplementation returns the common ciphersuite implementation used by this app
export async function cipherSuiteImplementation(): Promise<CiphersuiteImpl> {
	const cipherSuiteName: CiphersuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"
	const cipherSuite = await getCiphersuiteImpl(cipherSuiteName)
	return cipherSuite;
}

// newKeyPackage generates a new KeyPackage for the specified actor ID, using the common ciphersuite
export async function newKeyPackage(actorId: string): Promise<{ publicPackage: KeyPackage, privatePackage: PrivateKeyPackage }> {

	// Use the common ciphersuite
	const cipherSuite = await cipherSuiteImplementation()

	// Create a credential for this User
	const credential: Credential = {
		credentialType: defaultCredentialTypes.basic,
		identity: new TextEncoder().encode(actorId),
	}

	// Generate initial key package for this user
	return await generateKeyPackage({
		credential: credential,
		cipherSuite: cipherSuite,
		lifetime: defaultLifetime(),
	})
}

// generateAESKey generates a new random AES-GCM key for encrypting messages
export async function generateAESKey() {
	return await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 }, // Algorithm
		true,                             // "extractable" (required for wrapKey)
		["encrypt", "decrypt"]            // Key usages
	);
}

// deriveKeyFromPassword derives a symmetric encryption key from the specified password and salt using PBKDF2
export async function deriveKeyFromPassword(passcode: string, salt: ArrayBuffer): Promise<CryptoKey> {

	// RULE: Require salt to be 16+ bytes long (128 bits) for PBKDF2
	if (salt.byteLength < 16) {
		throw new Error("Salt must be at least 16 bytes long")
	}

	// Convert the passcode into a CryptoKey that can be used as the basis for key derivation
	const baseKey = await crypto.subtle.importKey(
		"raw",                               // Format of the key material
		new TextEncoder().encode(passcode),  // Key material
		"PBKDF2",                            // Algorithm
		false,                               // extractable
		["deriveKey"]                        // Key usages
	);

	// Create a "wrapping" crypto key using PBKDF2 with the specified salt.
	// This key will be used to wrap (encrypt) the actual encryption key before storing it in the database.
	// Using PBKDF2 with a unique salt for each user and a high iteration count 
	// helps protect against brute-force attacks on the passcode, even if the wrapped key is compromised.
	// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
	return await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 600_000, // OWASP recommends 600,000 iterattions for FIPS-compliance
			hash: "SHA-256"
		},
		baseKey,
		{ name: "AES-GCM", length: 256 },
		true,
		["wrapKey", "unwrapKey"]
	)
}



// wrapKey wraps the actual AES encryption key using the wrapping key (derived from a passcode) and the initial value
export async function wrapKey(encryptionKey: CryptoKey, wrappingKey: CryptoKey, iv: ArrayBuffer): Promise<ArrayBuffer> {
	return crypto.subtle.wrapKey(
		"raw",
		encryptionKey,
		wrappingKey,
		{ name: "AES-GCM", iv: iv }
	)
}

export async function unwrapKey(wrappedKey: ArrayBuffer, wrappingKey: CryptoKey, iv: ArrayBuffer): Promise<CryptoKey> {

	return crypto.subtle.unwrapKey(
		"raw",
		wrappedKey,                       // the encrypted key data
		wrappingKey,                      // the KEK (PBKDF2 derived key)
		{ name: "AES-GCM", iv: iv },      // <- HOW to decrypt the wrapped key (AES-GCM + the IV)
		{ name: "AES-GCM", length: 256 }, // <- what TYPE of key comes out the other end
		true,                             // extractable
		["encrypt", "decrypt"]            // key usages
	)
}

// encodeToBase64 encodes a CryptoKey to a Base64 string for storage or transmission
export async function encodeKeyToBase64(key: CryptoKey): Promise<string> {
	const exported = await crypto.subtle.exportKey("raw", key)
	const keyBytes = new Uint8Array(exported);
	const keyString = String.fromCharCode(...keyBytes);
	const base64Key = btoa(keyString);
	return base64Key;
}

// decodeKeyFromBase64 decodes a Base64 string back into a CryptoKey
export async function decodeKeyFromBase64(base64Key: string): Promise<CryptoKey> {

	const keyString = atob(base64Key)
	const rawKey = Uint8Array.from(keyString, c => c.charCodeAt(0));
	return crypto.subtle.importKey(
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