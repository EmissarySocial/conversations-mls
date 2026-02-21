import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export declare const wireformats: {
    readonly mls_public_message: 1;
    readonly mls_private_message: 2;
    readonly mls_welcome: 3;
    readonly mls_group_info: 4;
    readonly mls_key_package: 5;
};
/** @public */
export type WireformatName = keyof typeof wireformats;
/** @public */
export type WireformatValue = (typeof wireformats)[WireformatName];
export declare const wireformatEncoder: Encoder<WireformatValue>;
export declare const wireformatDecoder: Decoder<WireformatValue>;
