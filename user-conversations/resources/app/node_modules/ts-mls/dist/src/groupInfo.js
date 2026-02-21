import { uint32Decoder, uint32Encoder } from "./codec/number.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders, encode } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenTypeDecoder, varLenDataEncoder, varLenTypeEncoder } from "./codec/variableLength.js";
import { deriveSecret } from "./crypto/kdf.js";
import { signWithLabel, verifyWithLabel } from "./crypto/signature.js";
import { extensionEncoder, groupInfoExtensionDecoder } from "./extension.js";
import { groupContextDecoder, groupContextEncoder, extractEpochSecret } from "./groupContext.js";
import { ratchetTreeDecoder } from "./ratchetTree.js";
import { defaultExtensionTypes } from "./defaultExtensionType.js";
import { CodecError } from "./mlsError.js";
export const groupInfoTBSEncoder = contramapBufferEncoders([groupContextEncoder, varLenTypeEncoder(extensionEncoder), varLenDataEncoder, uint32Encoder], (g) => [g.groupContext, g.extensions, g.confirmationTag, g.signer]);
export const groupInfoTBSDecoder = mapDecoders([groupContextDecoder, varLenTypeDecoder(groupInfoExtensionDecoder), varLenDataDecoder, uint32Decoder], (groupContext, extensions, confirmationTag, signer) => ({
    groupContext,
    extensions,
    confirmationTag,
    signer,
}));
export const groupInfoEncoder = contramapBufferEncoders([groupInfoTBSEncoder, varLenDataEncoder], (g) => [g, g.signature]);
export const groupInfoDecoder = mapDecoders([groupInfoTBSDecoder, varLenDataDecoder], (tbs, signature) => ({
    ...tbs,
    signature,
}));
export function ratchetTreeFromExtension(info) {
    const treeExtension = info.extensions.find((ex) => ex.extensionType === defaultExtensionTypes.ratchet_tree);
    if (treeExtension !== undefined) {
        const tree = ratchetTreeDecoder(treeExtension.extensionData, 0);
        if (tree === undefined)
            throw new CodecError("Could not decode RatchetTree");
        return tree[0];
    }
}
export async function signGroupInfo(tbs, privateKey, s) {
    const signature = await signWithLabel(privateKey, "GroupInfoTBS", encode(groupInfoTBSEncoder, tbs), s);
    return { ...tbs, signature };
}
export function verifyGroupInfoSignature(gi, publicKey, s) {
    return verifyWithLabel(publicKey, "GroupInfoTBS", encode(groupInfoTBSEncoder, gi), gi.signature, s);
}
export async function verifyGroupInfoConfirmationTag(gi, joinerSecret, pskSecret, cs) {
    const epochSecret = await extractEpochSecret(gi.groupContext, joinerSecret, cs.kdf, pskSecret);
    const key = await deriveSecret(epochSecret, "confirm", cs.kdf);
    return cs.hash.verifyMac(key, gi.confirmationTag, gi.groupContext.confirmedTranscriptHash);
}
export async function extractWelcomeSecret(joinerSecret, pskSecret, kdf) {
    return deriveSecret(await kdf.extract(joinerSecret, pskSecret), "welcome", kdf);
}
//# sourceMappingURL=groupInfo.js.map