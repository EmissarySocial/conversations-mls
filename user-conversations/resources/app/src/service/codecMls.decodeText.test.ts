import { expect, test } from 'vitest'
import { decodeText } from './codecMls'

test('decodeText: known bytes decode to expected string', () => {
	expect(decodeText(new Uint8Array([72, 101, 108, 108, 111]))).toBe('Hello')
})

test('decodeText: empty Uint8Array decodes to empty string', () => {
	expect(decodeText(new Uint8Array([]))).toBe('')
})
