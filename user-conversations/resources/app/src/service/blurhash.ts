import { encode, decode, isBlurhashValid } from "blurhash"

// COMPONENTS_X / COMPONENTS_Y control the detail of an encoded BlurHash. 4x3 is the
// common default: enough to suggest the image without bloating the hash string.
const COMPONENTS_X = 4
const COMPONENTS_Y = 3

// SAMPLE_SIZE is the square the source image is downscaled to before encoding.
// BlurHash only needs a coarse signal, so a tiny sample keeps encoding fast.
const SAMPLE_SIZE = 32

// PLACEHOLDER_SIZE is the square the decoded BlurHash is rendered at. It is scaled
// up by the browser into a smooth blur, so a small canvas is plenty.
const PLACEHOLDER_SIZE = 32

// encodeBlurhash loads an image URL, downscales it onto a canvas, and returns its
// BlurHash string. Returns "" if the image cannot be read (e.g. a cross-origin
// URL that taints the canvas), so callers can simply skip the placeholder.
export async function encodeBlurhash(url: string): Promise<string> {

	try {
		const image = await loadImage(url)
		const context = drawToCanvas(image, SAMPLE_SIZE, SAMPLE_SIZE)
		if (context == null) {
			return ""
		}

		const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
		return encode(pixels.data, pixels.width, pixels.height, COMPONENTS_X, COMPONENTS_Y)

	} catch (error) {
		console.warn("Unable to encode blurhash:", error)
		return ""
	}
}

// blurhashToDataUri decodes a BlurHash string into a small PNG "data:" URI that can
// be used as an <img> src or CSS background. Returns "" for an invalid hash.
export function blurhashToDataUri(blurhash: string): string {

	if (!isBlurhashValid(blurhash).result) {
		return ""
	}

	const pixels = decode(blurhash, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE)

	const canvas = document.createElement("canvas")
	canvas.width = PLACEHOLDER_SIZE
	canvas.height = PLACEHOLDER_SIZE

	const context = canvas.getContext("2d")
	if (context == null) {
		return ""
	}

	const imageData = context.createImageData(PLACEHOLDER_SIZE, PLACEHOLDER_SIZE)
	imageData.data.set(pixels)
	context.putImageData(imageData, 0, 0)

	return canvas.toDataURL()
}

// #dataUriCache memoizes decoded BlurHash data URIs so repeated redraws of the
// same attachment do not re-run the decode/canvas work each time.
const dataUriCache = new Map<string, string>()

// blurhashBackgroundStyle returns an inline-style string that paints the
// attachment's BlurHash as a cover background, or "" if there is no (valid) hash.
// Used behind an <img>, the background shows while the image loads and is then
// covered once the image paints. Results are cached per hash.
export function blurhashBackgroundStyle(blurhash: string | undefined): string {

	if (blurhash == undefined || blurhash == "") {
		return ""
	}

	let dataUri = dataUriCache.get(blurhash)
	if (dataUri == undefined) {
		dataUri = blurhashToDataUri(blurhash)
		dataUriCache.set(blurhash, dataUri)
	}

	if (dataUri == "") {
		return ""
	}

	return `background-image:url(${dataUri});background-size:cover;background-position:center;`
}

// loadImage resolves to a fully-decoded HTMLImageElement for the given URL.
function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error("Unable to load image for blurhash"))
		image.src = url
	})
}

// drawToCanvas paints an image, scaled to fit `width`x`height`, onto an offscreen
// canvas and returns its 2D context (or null if a context cannot be created).
function drawToCanvas(image: HTMLImageElement, width: number, height: number): CanvasRenderingContext2D | null {

	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height

	const context = canvas.getContext("2d")
	if (context == null) {
		return null
	}

	context.drawImage(image, 0, 0, width, height)
	return context
}
