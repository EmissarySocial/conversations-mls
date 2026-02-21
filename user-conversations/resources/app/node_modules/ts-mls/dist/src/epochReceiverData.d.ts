import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { GroupContext } from "./groupContext.js";
import { RatchetTree } from "./ratchetTree.js";
import { SecretTree } from "./secretTree.js";
/**
 * This type contains everything necessary to receieve application messages for an earlier epoch
 *
 * @public
 */
export interface EpochReceiverData {
    resumptionPsk: Uint8Array;
    secretTree: SecretTree;
    ratchetTree: RatchetTree;
    senderDataSecret: Uint8Array;
    groupContext: GroupContext;
}
export declare const epochReceiverDataEncoder: Encoder<EpochReceiverData>;
export declare const epochReceiverDataDecoder: Decoder<EpochReceiverData>;
