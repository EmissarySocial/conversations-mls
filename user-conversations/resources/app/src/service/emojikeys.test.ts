import { expect, test } from 'vitest'
import { type Emoji, emojiKey } from "./emojikeys"

test('test key A => Mosque, Watermelon, Juice Box, X-Ray, Peanut', async () => {
	const buffer = new TextEncoder().encode("test key A")
	const result = await emojiKey(buffer)
	expect(result).toEqual([["🕌", "Mosque"], ["🍉", "Watermelon"], ["🧃", "Juice Box"], ["🩻", "X-Ray"], ["🥜", "Peanut"]])
})

test('test key 2 => Full Moon, Globe, Canoe, Teapot, Peacock', async () => {
	const buffer = new TextEncoder().encode("test key 2")
	const result = await emojiKey(buffer)
	expect(result).toEqual([["🌕", "Full Moon"], ["🌏", "Globe"], ["🛶", "Canoe"], ["🫖", "Teapot"], ["🦚", "Peacock"]])
})
