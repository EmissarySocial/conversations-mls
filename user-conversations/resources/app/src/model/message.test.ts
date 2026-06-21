import { test, expect, describe } from 'vitest'
import {
	type Attachment,
	attachmentIcon,
	attachmentKind,
	attachmentToDocument,
	dataUriToAttachment,
	legacyAttachmentToAttachment,
} from "./message"

// makeAttachment builds an Attachment fixture, defaulting every field so a test
// only has to specify the parts it cares about.
function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
	return {
		url: overrides.url ?? "https://x.test/file",
		mediaType: overrides.mediaType ?? "",
		name: overrides.name ?? "",
		size: overrides.size ?? 0,
		...(overrides.width != undefined ? { width: overrides.width } : {}),
		...(overrides.height != undefined ? { height: overrides.height } : {}),
	}
}

describe("attachmentKind", () => {

	test("classifies image, video, and audio by mediaType prefix", () => {
		expect(attachmentKind(makeAttachment({ mediaType: "image/png" }))).toBe("image")
		expect(attachmentKind(makeAttachment({ mediaType: "video/mp4" }))).toBe("video")
		expect(attachmentKind(makeAttachment({ mediaType: "audio/mpeg" }))).toBe("audio")
	})

	test("is case-insensitive about the mediaType", () => {
		expect(attachmentKind(makeAttachment({ mediaType: "IMAGE/PNG" }))).toBe("image")
		expect(attachmentKind(makeAttachment({ mediaType: "Video/MP4" }))).toBe("video")
	})

	test("treats anything unrecognized as a downloadable file", () => {
		expect(attachmentKind(makeAttachment({ mediaType: "application/pdf" }))).toBe("file")
		expect(attachmentKind(makeAttachment({ mediaType: "text/plain" }))).toBe("file")
		expect(attachmentKind(makeAttachment({ mediaType: "" }))).toBe("file")
	})
})

describe("attachmentIcon", () => {

	test("uses the media-kind icon for image, video, and audio", () => {
		expect(attachmentIcon(makeAttachment({ mediaType: "image/png" }))).toBe("bi-file-earmark-image")
		expect(attachmentIcon(makeAttachment({ mediaType: "video/mp4" }))).toBe("bi-file-earmark-play")
		expect(attachmentIcon(makeAttachment({ mediaType: "audio/mpeg" }))).toBe("bi-file-earmark-music")
	})

	test("refines the file icon for common document types", () => {
		expect(attachmentIcon(makeAttachment({ mediaType: "application/pdf" }))).toBe("bi-file-earmark-pdf")
		expect(attachmentIcon(makeAttachment({ mediaType: "text/csv" }))).toBe("bi-file-earmark-text")
		expect(attachmentIcon(makeAttachment({ mediaType: "application/zip" }))).toBe("bi-file-earmark-zip")
		expect(attachmentIcon(makeAttachment({ mediaType: "application/x-compressed" }))).toBe("bi-file-earmark-zip")
	})

	test("falls back to the generic file icon", () => {
		expect(attachmentIcon(makeAttachment({ mediaType: "application/octet-stream" }))).toBe("bi-file-earmark")
		expect(attachmentIcon(makeAttachment({ mediaType: "" }))).toBe("bi-file-earmark")
	})
})

describe("dataUriToAttachment", () => {

	test("parses the mediaType from a base64 data URI and keeps name/size", () => {
		const attachment = dataUriToAttachment("data:image/png;base64,AAAA", "photo.png", 1234)
		expect(attachment).toEqual({
			url: "data:image/png;base64,AAAA",
			mediaType: "image/png",
			name: "photo.png",
			size: 1234,
		})
	})

	test("parses the mediaType from a non-base64 data URI", () => {
		const attachment = dataUriToAttachment("data:text/plain,hello", "note.txt", 5)
		expect(attachment.mediaType).toBe("text/plain")
	})

	test("yields an empty mediaType when the data URI omits one", () => {
		expect(dataUriToAttachment("data:,hello", "x", 0).mediaType).toBe("")
	})
})

describe("legacyAttachmentToAttachment", () => {

	test("upgrades a bare URL with unknown mediaType and size", () => {
		expect(legacyAttachmentToAttachment("https://x.test/file.txt")).toEqual({
			url: "https://x.test/file.txt",
			mediaType: "",
			name: "",
			size: 0,
		})
	})

	test("derives mediaType and decoded size from a base64 data URI", () => {
		// "AAAA" decodes to 3 bytes (no padding)
		const attachment = legacyAttachmentToAttachment("data:image/png;base64,AAAA")
		expect(attachment.mediaType).toBe("image/png")
		expect(attachment.size).toBe(3)
	})

	test("accounts for base64 padding when computing size", () => {
		// "AAA=" -> 2 bytes, "AA==" -> 1 byte
		expect(legacyAttachmentToAttachment("data:application/octet-stream;base64,AAA=").size).toBe(2)
		expect(legacyAttachmentToAttachment("data:application/octet-stream;base64,AA==").size).toBe(1)
	})

	test("reports size 0 for a non-base64 data URI", () => {
		expect(legacyAttachmentToAttachment("data:text/plain,hello").size).toBe(0)
	})
})

describe("attachmentToDocument", () => {

	test("maps each kind to its ActivityStreams type", () => {
		expect(attachmentToDocument(makeAttachment({ mediaType: "image/png" })).type).toBe("Image")
		expect(attachmentToDocument(makeAttachment({ mediaType: "video/mp4" })).type).toBe("Video")
		expect(attachmentToDocument(makeAttachment({ mediaType: "audio/mpeg" })).type).toBe("Audio")
		expect(attachmentToDocument(makeAttachment({ mediaType: "application/pdf" })).type).toBe("Document")
	})

	test("carries url, mediaType, and name", () => {
		const document = attachmentToDocument(makeAttachment({
			url: "https://x.test/a.png",
			mediaType: "image/png",
			name: "a.png",
		}))
		expect(document.url).toBe("https://x.test/a.png")
		expect(document.mediaType).toBe("image/png")
		expect(document.name).toBe("a.png")
	})

	test("omits width/height when they are unknown", () => {
		const document = attachmentToDocument(makeAttachment({ mediaType: "image/png" }))
		expect(document).not.toHaveProperty("width")
		expect(document).not.toHaveProperty("height")
	})

	test("includes width/height when they are known", () => {
		const document = attachmentToDocument(makeAttachment({ mediaType: "image/png", width: 640, height: 480 }))
		expect(document.width).toBe(640)
		expect(document.height).toBe(480)
	})
})
