import type { KeyPackage } from "ts-mls"
import type { PrivateKeyPackage } from "ts-mls"

export type CipherSuiteName = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519"

export type DBKeyPackage = {
	id: string
	keyPackageURL: string
	publicKeyPackage: KeyPackage
	privateKeyPackage: PrivateKeyPackage
	createDate: number
}
