import { Encoder } from "./codec/tlsEncoder.js";
import { Decoder } from "./codec/tlsDecoder.js";
/** @public */
export interface Lifetime {
    notBefore: bigint;
    notAfter: bigint;
}
export declare const lifetimeEncoder: Encoder<Lifetime>;
export declare const lifetimeDecoder: Decoder<Lifetime>;
/** @public */
export declare function defaultLifetime(): Lifetime;
