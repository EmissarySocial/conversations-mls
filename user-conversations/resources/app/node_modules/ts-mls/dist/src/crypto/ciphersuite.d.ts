import { Signature, SignatureAlgorithm } from "./signature.js";
import { Hash, HashAlgorithm } from "./hash.js";
import { Kdf } from "./kdf.js";
import { Hpke, HpkeAlgorithm } from "./hpke.js";
import { Rng } from "./rng.js";
/** @public */
export interface CiphersuiteImpl {
    hash: Hash;
    hpke: Hpke;
    signature: Signature;
    kdf: Kdf;
    rng: Rng;
    id: number;
}
/** @public */
export declare const ciphersuites: {
    readonly MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519: 1;
    readonly MLS_128_DHKEMP256_AES128GCM_SHA256_P256: 2;
    readonly MLS_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519: 3;
    readonly MLS_256_DHKEMX448_AES256GCM_SHA512_Ed448: 4;
    readonly MLS_256_DHKEMP521_AES256GCM_SHA512_P521: 5;
    readonly MLS_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448: 6;
    readonly MLS_256_DHKEMP384_AES256GCM_SHA384_P384: 7;
    readonly MLS_128_MLKEM512_AES128GCM_SHA256_Ed25519: 61447;
    readonly MLS_128_MLKEM512_CHACHA20POLY1305_SHA256_Ed25519: 61448;
    readonly MLS_256_MLKEM768_AES256GCM_SHA384_Ed25519: 61449;
    readonly MLS_256_MLKEM768_CHACHA20POLY1305_SHA384_Ed25519: 61450;
    readonly MLS_256_MLKEM1024_AES256GCM_SHA512_Ed25519: 61451;
    readonly MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_Ed25519: 61452;
    readonly MLS_256_XWING_AES256GCM_SHA512_Ed25519: 61453;
    readonly MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519: 61454;
    readonly MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87: 61455;
    readonly MLS_256_MLKEM1024_CHACHA20POLY1305_SHA512_MLDSA87: 61456;
    readonly MLS_256_XWING_AES256GCM_SHA512_MLDSA87: 61457;
    readonly MLS_256_XWING_CHACHA20POLY1305_SHA512_MLDSA87: 61458;
};
/** @public */
export type CiphersuiteName = keyof typeof ciphersuites;
/** @public */
export type CiphersuiteId = (typeof ciphersuites)[CiphersuiteName];
export declare function isDefaultCiphersuiteId(id: number): id is CiphersuiteId;
/** @public */
export declare function getCiphersuiteFromName(name: CiphersuiteName): Ciphersuite;
export declare const ciphersuiteValues: Record<CiphersuiteId, Ciphersuite>;
/** @public */
export type Ciphersuite = {
    hash: HashAlgorithm;
    hpke: HpkeAlgorithm;
    signature: SignatureAlgorithm;
    id: number;
};
