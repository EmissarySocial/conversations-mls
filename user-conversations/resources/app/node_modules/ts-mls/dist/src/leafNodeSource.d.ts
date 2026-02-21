import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export declare const leafNodeSources: {
    readonly key_package: 1;
    readonly update: 2;
    readonly commit: 3;
};
/** @public */
export type LeafNodeSourceName = keyof typeof leafNodeSources;
/** @public */
export type LeafNodeSourceValue = (typeof leafNodeSources)[LeafNodeSourceName];
export declare const leafNodeSourceValueEncoder: Encoder<LeafNodeSourceValue>;
export declare const leafNodeSourceValueDecoder: Decoder<LeafNodeSourceValue>;
