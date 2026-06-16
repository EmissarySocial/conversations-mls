import type { KeyPackage, PrivateKeyPackage } from "ts-mls"
import type { EmojiKey } from "./emoji"

export type CipherSuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"

export type DBKeyPackage = {
	id: string
	keyPackageURL: string
	publicKeyPackage: KeyPackage
	privateKeyPackage: PrivateKeyPackage
	generatorId: string
	generatorName: string
	actorId: string
	signature: string
	emojiKey: EmojiKey[]
	createDate: number
}
