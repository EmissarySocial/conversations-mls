import { expect, test } from 'vitest'
import { decode, keyPackageDecoder } from 'ts-mls'
import { emojiKey, emojiKeySummary, keyPackageEmojiKey } from "./emojikeys"
import { base64ToUint8Array } from "./utils"

// These two vectors are shared ground truth with Bonfire: they mirror the doctests
// on `signature_key_to_emoji_fingerprint` in bonfire-networks/tauri-plugin-openmls.

test('test key A => Mosque, Watermelon, Juice Box, X-Ray, Peanut', async () => {
	const buffer = new TextEncoder().encode("test key A")
	const result = await emojiKey(buffer)
	expect(result).toEqual([
		"4N0Pcss20QcSn4D64OfooibR56PTnawKNfBlO/yxkIU=",
		[["🕌", "Mosque"], ["🍉", "Watermelon"], ["🧃", "Juice Box"], ["🩻", "X-Ray"], ["🥜", "Peanut"]],
	])
})

test('test key 2 => Full Moon, Globe, Canoe, Teapot, Peacock', async () => {
	const buffer = new TextEncoder().encode("test key 2")
	const result = await emojiKey(buffer)
	expect(result).toEqual([
		"kOGm3x/6VEKfHIHYUW1uecf9by3yQV86t5SzTcgOQHQ=",
		[["🌕", "Full Moon"], ["🌏", "Globe"], ["🛶", "Canoe"], ["🫖", "Teapot"], ["🦚", "Peacock"]],
	])
})

test('emojiKeySummary joins the emoji characters', () => {
	expect(emojiKeySummary([["🕌", "Mosque"], ["🍉", "Watermelon"]])).toBe("🕌🍉")
	expect(emojiKeySummary([])).toBe("")
})

// A real leaf signature public key from a KeyPackage published by bandwagon.fm,
// whose fingerprint Bonfire independently computed as ✏️🐪📊🖥️✈️.
test('leaf signature public key => Pencil, Camel, Bar Chart, Desktop, Aeroplane', async () => {
	expect.hasAssertions()

	const hex = "5e7caa319f927844c30129ea762997ed120889337e870124041c600a5ac2e91e"
	const signaturePublicKey = Uint8Array.from({ length: hex.length / 2 }, (_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16))

	const [checksum, emojis] = await emojiKey(signaturePublicKey)
	expect(checksum).toBe("u3lb/8S0GvvrXSZT4Q97RH2SpBaYMP9TnUVqaRcZ7og=")
	expect(emojis).toEqual([["✏️", "Pencil"], ["🐪", "Camel"], ["📊", "Bar Chart"], ["🖥️", "Desktop"], ["✈️", "Aeroplane"]])
})

// The KeyPackage that contains the signature public key above, exactly as published
// (raw TLS KeyPackage format, base64). Public data: to:Public on the fediverse.
const BANDWAGON_KEYPACKAGE =
	"AAEAASD24CqDyj2EWgwhG36s8Nhynu3yEygA+qKiI1KdlU7qPSA2ZWVQ4BrH22cLbPeIhP6pg8x7iA5rMEatXDBpV4QwOCBefKoxn5J4RMMBKep2KZftEgiJM36HASQEHGAKWsLpHgABLmh0dHBzOi8vYmFuZHdhZ29uLmZtL0A2Njc4NWZhOWUwZDRkZmVjOGNkMjc2OTcCAAEmAAEAAgADAAQABQAGAAfwB/AI8AnwCvAL8AzwDfAO8A/wEPAR8BICWloGGhra2urqDAABAAIKChoaKipKSgEAAAAAamkCCAAAAABsRO+IAEBAIrGCBX9g0EqO9I66UlQZbh7n1rQ5+Y6tZICYsPovApxvxsvsPbrWQTzGYcGtqZm7yiz30JczD2kVoBwzFHngBgBAQAdBBhAfl1d3Itv0T5Z/Js6nJ5tgsm6zNh/hIdq8crYNbK9aHcdffkAUVeM7shAJLivPYk2fGcwSq7Km4xwW3go="

// Pins the interop contract end-to-end: decode the published bytes, extract the
// leaf's signature public key, hash, and map. The input is leafNode.signaturePublicKey —
// never the KeyPackage `signature` field, which differs for every single-use package.
test('keyPackageEmojiKey fingerprints the leaf signature public key', async () => {
	expect.hasAssertions()

	const keyPackage = decode(keyPackageDecoder, base64ToUint8Array(BANDWAGON_KEYPACKAGE))

	if (keyPackage == undefined) {
		throw new Error("Unable to decode test KeyPackage")
	}

	const [checksum, emojis] = await keyPackageEmojiKey(keyPackage)
	expect(checksum).toBe("u3lb/8S0GvvrXSZT4Q97RH2SpBaYMP9TnUVqaRcZ7og=")
	expect(emojiKeySummary(emojis)).toBe("✏️🐪📊🖥️✈️")
})
