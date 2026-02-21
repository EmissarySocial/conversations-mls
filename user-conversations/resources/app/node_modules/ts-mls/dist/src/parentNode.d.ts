import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export interface ParentNode {
    hpkePublicKey: Uint8Array;
    parentHash: Uint8Array;
    unmergedLeaves: number[];
}
export declare const parentNodeEncoder: Encoder<ParentNode>;
export declare const parentNodeDecoder: Decoder<ParentNode>;
