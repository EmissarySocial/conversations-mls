import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenDataEncoder } from "./codec/variableLength.js";
import { deriveSecret, expandWithLabel } from "./crypto/kdf.js";
import { extractEpochSecret, extractJoinerSecret } from "./groupContext.js";
import { extractWelcomeSecret } from "./groupInfo.js";
export const keyScheduleEncoder = contramapBufferEncoders([
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
    varLenDataEncoder,
], (ks) => [
    ks.senderDataSecret,
    ks.exporterSecret,
    ks.externalSecret,
    ks.confirmationKey,
    ks.membershipKey,
    ks.resumptionPsk,
    ks.epochAuthenticator,
    ks.initSecret,
]);
export const keyScheduleDecoder = mapDecoders([
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
    varLenDataDecoder,
], (senderDataSecret, exporterSecret, externalSecret, confirmationKey, membershipKey, resumptionPsk, epochAuthenticator, initSecret) => ({
    senderDataSecret,
    exporterSecret,
    externalSecret,
    confirmationKey,
    membershipKey,
    resumptionPsk,
    epochAuthenticator,
    initSecret,
}));
/** @public */
export async function mlsExporter(exporterSecret, label, context, length, cs) {
    const secret = await deriveSecret(exporterSecret, label, cs.kdf);
    const hash = await cs.hash.digest(context);
    return expandWithLabel(secret, "exported", hash, length, cs.kdf);
}
export async function deriveKeySchedule(joinerSecret, pskSecret, groupContext, kdf) {
    const epochSecret = await extractEpochSecret(groupContext, joinerSecret, kdf, pskSecret);
    const encryptionSecret = await deriveSecret(epochSecret, "encryption", kdf);
    const keySchedule = await initializeKeySchedule(epochSecret, kdf);
    return [keySchedule, encryptionSecret];
}
export async function initializeKeySchedule(epochSecret, kdf) {
    const newInitSecret = await deriveSecret(epochSecret, "init", kdf);
    const senderDataSecret = await deriveSecret(epochSecret, "sender data", kdf);
    const exporterSecret = await deriveSecret(epochSecret, "exporter", kdf);
    const externalSecret = await deriveSecret(epochSecret, "external", kdf);
    const confirmationKey = await deriveSecret(epochSecret, "confirm", kdf);
    const membershipKey = await deriveSecret(epochSecret, "membership", kdf);
    const resumptionPsk = await deriveSecret(epochSecret, "resumption", kdf);
    const epochAuthenticator = await deriveSecret(epochSecret, "authentication", kdf);
    const newKeySchedule = {
        initSecret: newInitSecret,
        senderDataSecret,
        exporterSecret,
        externalSecret,
        confirmationKey,
        membershipKey,
        resumptionPsk,
        epochAuthenticator,
    };
    return newKeySchedule;
}
export async function initializeEpoch(initSecret, commitSecret, groupContext, pskSecret, kdf) {
    const joinerSecret = await extractJoinerSecret(groupContext, initSecret, commitSecret, kdf);
    const welcomeSecret = await extractWelcomeSecret(joinerSecret, pskSecret, kdf);
    const [newKeySchedule, encryptionSecret] = await deriveKeySchedule(joinerSecret, pskSecret, groupContext, kdf);
    return { welcomeSecret, joinerSecret, encryptionSecret, keySchedule: newKeySchedule };
}
//# sourceMappingURL=keySchedule.js.map