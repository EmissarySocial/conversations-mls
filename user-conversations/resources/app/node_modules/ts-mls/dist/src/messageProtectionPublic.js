import { createMembershipTag, verifyMembershipTag, } from "./authenticatedContent.js";
import { signFramedContentApplicationOrProposal, toTbs, verifyFramedContentSignature, } from "./framedContent.js";
import { CryptoVerificationError, UsageError } from "./mlsError.js";
import { findSignaturePublicKey } from "./publicMessage.js";
import { senderTypes } from "./sender.js";
import { contentTypes } from "./contentType.js";
import { wireformats } from "./wireformat.js";
export async function protectProposalPublic(signKey, membershipKey, groupContext, authenticatedData, proposal, leafIndex, cs) {
    const framedContent = {
        groupId: groupContext.groupId,
        epoch: groupContext.epoch,
        sender: { senderType: senderTypes.member, leafIndex },
        contentType: contentTypes.proposal,
        authenticatedData,
        proposal,
    };
    const tbs = {
        protocolVersion: groupContext.version,
        wireformat: wireformats.mls_public_message,
        content: framedContent,
        senderType: senderTypes.member,
        context: groupContext,
    };
    const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
    const authenticatedContent = {
        wireformat: wireformats.mls_public_message,
        content: framedContent,
        auth,
    };
    const msg = await protectPublicMessage(membershipKey, groupContext, authenticatedContent, cs);
    return { publicMessage: msg };
}
export async function protectExternalProposalPublic(signKey, groupContext, authenticatedData, proposal, sender, cs) {
    const framedContent = {
        groupId: groupContext.groupId,
        epoch: groupContext.epoch,
        sender,
        contentType: contentTypes.proposal,
        authenticatedData,
        proposal,
    };
    const tbs = {
        protocolVersion: groupContext.version,
        wireformat: wireformats.mls_public_message,
        content: framedContent,
        senderType: sender.senderType,
        context: groupContext,
    };
    const auth = await signFramedContentApplicationOrProposal(signKey, tbs, cs);
    const msg = {
        content: framedContent,
        auth,
        senderType: sender.senderType,
    };
    return { publicMessage: msg };
}
export async function protectPublicMessage(membershipKey, groupContext, content, cs) {
    if (content.content.contentType === contentTypes.application)
        throw new UsageError("Can't make an application message public");
    if (content.content.sender.senderType === senderTypes.member) {
        const authenticatedContent = {
            contentTbs: toTbs(content.content, wireformats.mls_public_message, groupContext),
            auth: content.auth,
        };
        const tag = await createMembershipTag(membershipKey, authenticatedContent, cs.hash);
        return {
            content: content.content,
            auth: content.auth,
            senderType: senderTypes.member,
            membershipTag: tag,
        };
    }
    return {
        content: content.content,
        auth: content.auth,
        senderType: content.content.sender.senderType,
    };
}
export async function unprotectPublicMessage(membershipKey, groupContext, ratchetTree, msg, cs, overrideSignatureKey) {
    if (msg.content.contentType === contentTypes.application)
        throw new UsageError("Can't make an application message public");
    if (msg.senderType === senderTypes.member) {
        const authenticatedContent = {
            contentTbs: toTbs(msg.content, wireformats.mls_public_message, groupContext),
            auth: msg.auth,
        };
        if (!(await verifyMembershipTag(membershipKey, authenticatedContent, msg.membershipTag, cs.hash)))
            throw new CryptoVerificationError("Could not verify membership");
    }
    const signaturePublicKey = overrideSignatureKey !== undefined
        ? overrideSignatureKey
        : findSignaturePublicKey(ratchetTree, groupContext, msg.content);
    const signatureValid = await verifyFramedContentSignature(signaturePublicKey, wireformats.mls_public_message, msg.content, msg.auth, groupContext, cs.signature);
    if (!signatureValid)
        throw new CryptoVerificationError("Signature invalid");
    return {
        wireformat: wireformats.mls_public_message,
        content: msg.content,
        auth: msg.auth,
    };
}
//# sourceMappingURL=messageProtectionPublic.js.map