import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { ProposalOrRef } from "./proposalOrRefType.js";
import { UpdatePath } from "./updatePath.js";
/** @public */
export interface Commit {
    proposals: ProposalOrRef[];
    path: UpdatePath | undefined;
}
export declare const commitEncoder: Encoder<Commit>;
export declare const commitDecoder: Decoder<Commit>;
