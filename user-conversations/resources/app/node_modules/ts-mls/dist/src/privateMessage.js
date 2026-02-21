import { uint64Decoder, uint64Encoder } from "./codec/number.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders, encode } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenDataEncoder } from "./codec/variableLength.js";
import { commitDecoder, commitEncoder } from "./commit.js";
import { contentTypes, contentTypeEncoder, contentTypeDecoder } from "./contentType.js";
import { framedContentAuthDataCommitDecoder, framedContentAuthDataEncoder, } from "./framedContent.js";
import { byteLengthToPad } from "./paddingConfig.js";
import { proposalDecoder, proposalEncoder } from "./proposal.js";
import { senderDataDecoder, senderDataEncoder, senderDataAADEncoder, expandSenderDataKey, expandSenderDataNonce, senderTypes, } from "./sender.js";
import { wireformats } from "./wireformat.js";
export const privateMessageEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, contentTypeEncoder, varLenDataEncoder, varLenDataEncoder, varLenDataEncoder], (msg) => [msg.groupId, msg.epoch, msg.contentType, msg.authenticatedData, msg.encryptedSenderData, msg.ciphertext]);
export const privateMessageDecoder = mapDecoders([varLenDataDecoder, uint64Decoder, contentTypeDecoder, varLenDataDecoder, varLenDataDecoder, varLenDataDecoder], (groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext) => ({
    groupId,
    epoch,
    contentType,
    authenticatedData,
    encryptedSenderData,
    ciphertext,
}));
export const privateContentAADEncoder = contramapBufferEncoders([varLenDataEncoder, uint64Encoder, contentTypeEncoder, varLenDataEncoder], (aad) => [aad.groupId, aad.epoch, aad.contentType, aad.authenticatedData]);
export const privateContentAADDecoder = mapDecoders([varLenDataDecoder, uint64Decoder, contentTypeDecoder, varLenDataDecoder], (groupId, epoch, contentType, authenticatedData) => ({
    groupId,
    epoch,
    contentType,
    authenticatedData,
}));
export function privateMessageContentDecoder(contentType) {
    switch (contentType) {
        case contentTypes.application:
            return rWithPaddingDecoder(mapDecoders([varLenDataDecoder, varLenDataDecoder], (applicationData, signature) => ({
                contentType,
                applicationData,
                auth: { contentType, signature },
            })));
        case contentTypes.proposal:
            return rWithPaddingDecoder(mapDecoders([proposalDecoder, varLenDataDecoder], (proposal, signature) => ({
                contentType,
                proposal,
                auth: { contentType, signature },
            })));
        case contentTypes.commit:
            return rWithPaddingDecoder(mapDecoders([commitDecoder, varLenDataDecoder, framedContentAuthDataCommitDecoder], (commit, signature, auth) => ({
                contentType,
                commit,
                auth: { ...auth, signature, contentType },
            })));
    }
}
export function privateMessageContentEncoder(config) {
    return (msg) => {
        switch (msg.contentType) {
            case contentTypes.application:
                return encoderWithPadding(contramapBufferEncoders([varLenDataEncoder, framedContentAuthDataEncoder], (m) => [m.applicationData, m.auth]), config)(msg);
            case contentTypes.proposal:
                return encoderWithPadding(contramapBufferEncoders([proposalEncoder, framedContentAuthDataEncoder], (m) => [m.proposal, m.auth]), config)(msg);
            case contentTypes.commit:
                return encoderWithPadding(contramapBufferEncoders([commitEncoder, framedContentAuthDataEncoder], (m) => [m.commit, m.auth]), config)(msg);
        }
    };
}
export async function decryptSenderData(msg, senderDataSecret, cs) {
    const key = await expandSenderDataKey(cs, senderDataSecret, msg.ciphertext);
    const nonce = await expandSenderDataNonce(cs, senderDataSecret, msg.ciphertext);
    const aad = {
        groupId: msg.groupId,
        epoch: msg.epoch,
        contentType: msg.contentType,
    };
    const decrypted = await cs.hpke.decryptAead(key, nonce, encode(senderDataAADEncoder, aad), msg.encryptedSenderData);
    return senderDataDecoder(decrypted, 0)?.[0];
}
export async function encryptSenderData(senderDataSecret, senderData, aad, ciphertext, cs) {
    const key = await expandSenderDataKey(cs, senderDataSecret, ciphertext);
    const nonce = await expandSenderDataNonce(cs, senderDataSecret, ciphertext);
    return await cs.hpke.encryptAead(key, nonce, encode(senderDataAADEncoder, aad), encode(senderDataEncoder, senderData));
}
export function toAuthenticatedContent(content, msg, senderLeafIndex) {
    return {
        wireformat: wireformats.mls_private_message,
        content: {
            groupId: msg.groupId,
            epoch: msg.epoch,
            sender: {
                senderType: senderTypes.member,
                leafIndex: senderLeafIndex,
            },
            authenticatedData: msg.authenticatedData,
            ...content,
        },
        auth: content.auth,
    };
}
function encoderWithPadding(encoder, config) {
    return (t) => {
        const [len, write] = encoder(t);
        const totalLength = len + byteLengthToPad(len, config);
        return [
            totalLength,
            (offset, buffer) => {
                write(offset, buffer);
            },
        ];
    };
}
function rWithPaddingDecoder(decoder) {
    return (bytes, offset) => {
        const result = decoder(bytes, offset);
        if (result === undefined)
            return undefined;
        const [decoded, innerOffset] = result;
        const paddingBytes = bytes.subarray(offset + innerOffset, bytes.length);
        const allZeroes = paddingBytes.every((byte) => byte === 0);
        if (!allZeroes)
            return undefined;
        return [decoded, bytes.length];
    };
}
//# sourceMappingURL=privateMessage.js.map