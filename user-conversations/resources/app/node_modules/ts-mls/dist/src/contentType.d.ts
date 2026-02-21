import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export declare const contentTypes: {
    readonly application: 1;
    readonly proposal: 2;
    readonly commit: 3;
};
/** @public */
export type ContentTypeName = keyof typeof contentTypes;
/** @public */
export type ContentTypeValue = (typeof contentTypes)[ContentTypeName];
export declare const contentTypeEncoder: Encoder<ContentTypeValue>;
export declare const contentTypeDecoder: Decoder<ContentTypeValue>;
