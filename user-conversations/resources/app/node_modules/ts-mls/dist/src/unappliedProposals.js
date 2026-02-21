import { uint32Decoder, uint32Encoder } from "./codec/number.js";
import { optionalDecoder, optionalEncoder } from "./codec/optional.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { base64RecordEncoder, base64RecordDecoder } from "./codec/variableLength.js";
import { proposalDecoder, proposalEncoder } from "./proposal.js";
import { bytesToBase64 } from "./util/byteArray.js";
export const proposalWithSenderEncoder = contramapBufferEncoders([proposalEncoder, optionalEncoder(uint32Encoder)], (pws) => [pws.proposal, pws.senderLeafIndex]);
export const proposalWithSenderDecoder = mapDecoders([proposalDecoder, optionalDecoder(uint32Decoder)], (proposal, senderLeafIndex) => ({
    proposal,
    senderLeafIndex,
}));
export const unappliedProposalsEncoder = base64RecordEncoder(proposalWithSenderEncoder);
export const unappliedProposalsDecoder = base64RecordDecoder(proposalWithSenderDecoder);
export function addUnappliedProposal(ref, proposals, proposal, senderLeafIndex) {
    const r = bytesToBase64(ref);
    return {
        ...proposals,
        [r]: { proposal, senderLeafIndex },
    };
}
//# sourceMappingURL=unappliedProposals.js.map