import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { Proposal } from "./proposal.js";
/** @public */
export interface ProposalWithSender {
    proposal: Proposal;
    senderLeafIndex: number | undefined;
}
export declare const proposalWithSenderEncoder: Encoder<ProposalWithSender>;
export declare const proposalWithSenderDecoder: Decoder<ProposalWithSender>;
/** @public */
export type UnappliedProposals = Record<string, ProposalWithSender>;
export declare const unappliedProposalsEncoder: Encoder<UnappliedProposals>;
export declare const unappliedProposalsDecoder: Decoder<UnappliedProposals>;
export declare function addUnappliedProposal(ref: Uint8Array, proposals: UnappliedProposals, proposal: Proposal, senderLeafIndex: number | undefined): UnappliedProposals;
