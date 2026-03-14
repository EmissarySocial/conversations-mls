import { uint16Decoder, uint16Encoder, uint64Decoder, uint64Encoder } from "./codec/number.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders, encode } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenTypeDecoder, varLenDataEncoder, varLenTypeEncoder } from "./codec/variableLength.js";
import { expandWithLabel } from "./crypto/kdf.js";
import { extensionEncoder, groupContextExtensionDecoder } from "./extension.js";
import { protocolVersionDecoder, protocolVersionEncoder } from "./protocolVersion.js";
export const groupContextEncoder = contramapBufferEncoders([
    protocolVersionEncoder,
    uint16Encoder,
    varLenDataEncoder, // groupId
    uint64Encoder, // epoch
    varLenDataEncoder, // treeHash
    varLenDataEncoder, // confirmedTranscriptHash
    varLenTypeEncoder(extensionEncoder),
], (gc) => [gc.version, gc.cipherSuite, gc.groupId, gc.epoch, gc.treeHash, gc.confirmedTranscriptHash, gc.extensions]);
export const groupContextDecoder = mapDecoders([
    protocolVersionDecoder,
    uint16Decoder,
    varLenDataDecoder, // groupId
    uint64Decoder, // epoch
    varLenDataDecoder, // treeHash
    varLenDataDecoder, // confirmedTranscriptHash
    varLenTypeDecoder(groupContextExtensionDecoder),
], (version, cipherSuite, groupId, epoch, treeHash, confirmedTranscriptHash, extensions) => ({
    version,
    cipherSuite,
    groupId,
    epoch,
    treeHash,
    confirmedTranscriptHash,
    extensions,
}));
export async function extractEpochSecret(context, joinerSecret, kdf, pskSecret) {
    const psk = pskSecret === undefined ? new Uint8Array(kdf.size) : pskSecret;
    const extracted = await kdf.extract(joinerSecret, psk);
    return expandWithLabel(extracted, "epoch", encode(groupContextEncoder, context), kdf.size, kdf);
}
export async function extractJoinerSecret(context, previousInitSecret, commitSecret, kdf) {
    const extracted = await kdf.extract(previousInitSecret, commitSecret);
    return expandWithLabel(extracted, "joiner", encode(groupContextEncoder, context), kdf.size, kdf);
}
//# sourceMappingURL=groupContext.js.map