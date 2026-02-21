import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { Credential } from "./credential.js";
/** @public */
export interface ExternalSender {
    signaturePublicKey: Uint8Array;
    credential: Credential;
}
export declare const externalSenderEncoder: Encoder<ExternalSender>;
export declare const externalSenderDecoder: Decoder<ExternalSender>;
