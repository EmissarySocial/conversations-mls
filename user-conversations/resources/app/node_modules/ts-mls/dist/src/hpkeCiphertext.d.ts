import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
/** @public */
export interface HPKECiphertext {
    kemOutput: Uint8Array;
    ciphertext: Uint8Array;
}
export declare const hpkeCiphertextEncoder: Encoder<HPKECiphertext>;
export declare const hpkeCiphertextDecoder: Decoder<HPKECiphertext>;
