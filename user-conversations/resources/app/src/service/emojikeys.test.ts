import { expect, test } from 'vitest'
import { emojiKey } from "./emojikeys"

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
