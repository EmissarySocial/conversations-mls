// mentionToken.ts — pure helpers for detecting and replacing the "@mention"
// token a user is actively typing in a plain-text field. These are framework-
// and DOM-agnostic (they operate on a string + caret index), so they can be unit
// tested in isolation and reused by any text input that wants @-autocomplete.

// MentionToken describes an in-progress "@query" the caret is currently inside.
// `start`/`end` are indices into the source text bounding the whole whitespace-
// delimited token (the "@" is at `start`); `query` is the token minus its leading
// "@" (what to search the server for).
export interface MentionToken {
	start: number
	end: number
	query: string
}

// A mention token runs from its "@" up to the caret and is bounded only by
// whitespace — any non-whitespace character is part of the token. (A fediverse
// handle can contain "@", ".", "-", and other punctuation, and the server needs
// the whole thing, so we do not restrict to an allowlist.)
const WHITESPACE = /\s/

// activeMentionToken returns the whitespace-delimited "@query" token the caret is
// inside, or null if the caret is not in a mention. The token is the entire word
// the caret sits within — bounded by whitespace on both sides — so editing in the
// middle of a handle still yields the full handle as the query (and replacing it
// replaces the whole handle, not just the part left of the caret).
//
// The query may itself be a fully-qualified fediverse handle ("user@host.social"):
// the leading "@" is dropped and everything else (including a second "@" and the
// domain) is the query. This matters because the server can resolve remote handles
// it doesn't yet know, but only if it receives the domain.
//
// The caret index is typically a textarea's `selectionStart`.
export function activeMentionToken(text: string, caret: number): MentionToken | null {

	if (caret < 0 || caret > text.length) {
		return null
	}

	// Scan left from the caret over non-whitespace to find the token start. Because
	// the scan stops at whitespace (or the start of the text), the resulting start
	// is always "word-initial" — which is what makes an "@" there a mention rather
	// than the "@host" half of a handle or the "@" in an email like "bob@x.com".
	let start = caret
	while (start > 0 && !WHITESPACE.test(text[start - 1]!)) {
		start--
	}

	// The token must begin with "@".
	if (text[start] !== "@") {
		return null
	}

	// Scan right from the caret to the next whitespace (or end) for the token end,
	// so the token spans the whole handle regardless of where the caret sits in it.
	let end = caret
	while (end < text.length && !WHITESPACE.test(text[end]!)) {
		end++
	}

	const query = text.slice(start + 1, end)

	return { start, end, query }
}

// replaceMentionToken splices `replacement` into `text` in place of the token's
// span, and returns the new text plus the caret index just past the replacement.
// The caller typically appends a trailing space to `replacement` so the caret
// lands ready for the next word.
export function replaceMentionToken(text: string, token: MentionToken, replacement: string): { text: string, caret: number } {
	const next = text.slice(0, token.start) + replacement + text.slice(token.end)
	return { text: next, caret: token.start + replacement.length }
}
