import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { Reinit } from "./proposal.js";
/** @public */
export type GroupActiveState = {
    kind: "active";
} | {
    kind: "suspendedPendingReinit";
    reinit: Reinit;
} | {
    kind: "removedFromGroup";
};
export declare const groupActiveStateEncoder: Encoder<GroupActiveState>;
export declare const groupActiveStateDecoder: Decoder<GroupActiveState>;
