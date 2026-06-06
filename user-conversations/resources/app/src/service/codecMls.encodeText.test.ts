import { expect, test } from 'vitest'
import { decodeText, encodeText } from './codecMls'

test('encodeText: ASCII string encodes to correct bytes', () => {
	expect(encodeText('abc')).toEqual(new Uint8Array([97, 98, 99]))
})

test('encodeText: empty string produces empty Uint8Array', () => {
	expect(encodeText('')).toEqual(new Uint8Array([]))
})

test('encodeText: URL string encodes as UTF-8', () => {
	const result = encodeText('https://alice.example/actor')
	expect(result).toBeInstanceOf(Uint8Array)
	expect(result.length).toBe('https://alice.example/actor'.length)
})

test('encodeText / decodeText round-trip: ASCII', () => {
	const original = 'https://alice.example/actor'
	expect(decodeText(encodeText(original))).toBe(original)
})

test('encodeText / decodeText round-trip: multi-byte Unicode', () => {
	const original = 'héllo wörld 🌍'
	expect(decodeText(encodeText(original))).toBe(original)
})
