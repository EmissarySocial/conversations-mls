import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export declare const protocolVersions: {
    readonly mls10: 1;
};
/** @public */
export type ProtocolVersionName = keyof typeof protocolVersions;
/** @public */
export type ProtocolVersionValue = (typeof protocolVersions)[ProtocolVersionName];
export declare const protocolVersionEncoder: Encoder<ProtocolVersionValue>;
export declare const protocolVersionDecoder: Decoder<ProtocolVersionValue>;
