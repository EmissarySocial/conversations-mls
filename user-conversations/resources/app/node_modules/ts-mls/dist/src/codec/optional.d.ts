import { Decoder } from "./tlsDecoder.js";
import { Encoder } from "./tlsEncoder.js";
export declare function optionalEncoder<T>(encodeT: Encoder<T>): Encoder<T | undefined>;
export declare function optionalDecoder<T>(decodeT: Decoder<T>): Decoder<T | undefined>;
