import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { CiphersuiteImpl } from "./crypto/ciphersuite.js";
/** @public */
export declare const pskTypes: {
    readonly external: 1;
    readonly resumption: 2;
};
/** @public */
export type PSKTypeName = keyof typeof pskTypes;
/** @public */
export type PSKTypeValue = (typeof pskTypes)[PSKTypeName];
export declare const pskTypeEncoder: Encoder<PSKTypeValue>;
export declare const pskTypeDecoder: Decoder<PSKTypeValue>;
/** @public */
export declare const resumptionPSKUsages: {
    readonly application: 1;
    readonly reinit: 2;
    readonly branch: 3;
};
/** @public */
export type ResumptionPSKUsageName = keyof typeof resumptionPSKUsages;
/** @public */
export type ResumptionPSKUsageValue = (typeof resumptionPSKUsages)[ResumptionPSKUsageName];
export declare const resumptionPSKUsageEncoder: Encoder<ResumptionPSKUsageValue>;
export declare const resumptionPSKUsageDecoder: Decoder<ResumptionPSKUsageValue>;
/** @public */
export interface PskInfoExternal {
    psktype: typeof pskTypes.external;
    pskId: Uint8Array;
}
/** @public */
export interface PskInfoResumption {
    psktype: typeof pskTypes.resumption;
    usage: ResumptionPSKUsageValue;
    pskGroupId: Uint8Array;
    pskEpoch: bigint;
}
/** @public */
export type PskInfo = PskInfoExternal | PskInfoResumption;
export declare const pskInfoEncoder: Encoder<PskInfo>;
export declare const pskInfoDecoder: Decoder<PskInfo>;
/** @public */
export type PskNonce = {
    pskNonce: Uint8Array;
};
/** @public */
export type PskId = PskInfo & PskNonce;
export declare const pskIdEncoder: Encoder<PskId>;
export declare const pskIdDecoder: Decoder<PskId>;
type PskLabel = {
    id: PskId;
    index: number;
    count: number;
};
export declare const pskLabelEncoder: Encoder<PskLabel>;
export declare const pskLabelDecoder: Decoder<PskLabel>;
export type PreSharedKeyIdExternal = PskInfoExternal & PskNonce;
export declare function computePskSecret(psks: [PskId, Uint8Array][], impl: CiphersuiteImpl): Promise<Uint8Array<ArrayBufferLike>>;
export declare function updatePskSecret(secret: Uint8Array, pskId: PskId, psk: Uint8Array, index: number, count: number, impl: CiphersuiteImpl): Promise<Uint8Array<ArrayBufferLike>>;
export {};
