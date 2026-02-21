import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { PskId } from "./presharedkey.js";
export interface GroupSecrets {
    joinerSecret: Uint8Array;
    pathSecret: Uint8Array | undefined;
    psks: PskId[];
}
export declare const groupSecretsEncoder: Encoder<GroupSecrets>;
export declare const groupSecretsDecoder: Decoder<GroupSecrets>;
