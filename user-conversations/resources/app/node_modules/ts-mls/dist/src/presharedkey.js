import { uint16Decoder, uint64Decoder, uint8Decoder, uint16Encoder, uint64Encoder, uint8Encoder, } from "./codec/number.js";
import { flatMapDecoder, mapDecoder, mapDecoderOption, mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders, encode } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenDataEncoder } from "./codec/variableLength.js";
import { expandWithLabel } from "./crypto/kdf.js";
import { numberToEnum } from "./util/enumHelpers.js";
/** @public */
export const pskTypes = {
    external: 1,
    resumption: 2,
};
export const pskTypeEncoder = uint8Encoder;
export const pskTypeDecoder = mapDecoderOption(uint8Decoder, numberToEnum(pskTypes));
/** @public */
export const resumptionPSKUsages = {
    application: 1,
    reinit: 2,
    branch: 3,
};
export const resumptionPSKUsageEncoder = uint8Encoder;
export const resumptionPSKUsageDecoder = mapDecoderOption(uint8Decoder, numberToEnum(resumptionPSKUsages));
const encodePskInfoExternal = contramapBufferEncoders([pskTypeEncoder, varLenDataEncoder], (i) => [i.psktype, i.pskId]);
const encodePskInfoResumption = contramapBufferEncoders([pskTypeEncoder, resumptionPSKUsageEncoder, varLenDataEncoder, uint64Encoder], (info) => [info.psktype, info.usage, info.pskGroupId, info.pskEpoch]);
const pskInfoResumptionDecoder = mapDecoders([resumptionPSKUsageDecoder, varLenDataDecoder, uint64Decoder], (usage, pskGroupId, pskEpoch) => {
    return { usage, pskGroupId, pskEpoch };
});
export const pskInfoEncoder = (info) => {
    switch (info.psktype) {
        case pskTypes.external:
            return encodePskInfoExternal(info);
        case pskTypes.resumption:
            return encodePskInfoResumption(info);
    }
};
export const pskInfoDecoder = flatMapDecoder(pskTypeDecoder, (psktype) => {
    switch (psktype) {
        case pskTypes.external:
            return mapDecoder(varLenDataDecoder, (pskId) => ({
                psktype,
                pskId,
            }));
        case pskTypes.resumption:
            return mapDecoder(pskInfoResumptionDecoder, (resumption) => ({
                psktype,
                ...resumption,
            }));
    }
});
export const pskIdEncoder = contramapBufferEncoders([pskInfoEncoder, varLenDataEncoder], (pskid) => [pskid, pskid.pskNonce]);
export const pskIdDecoder = mapDecoders([pskInfoDecoder, varLenDataDecoder], (info, pskNonce) => ({
    ...info,
    pskNonce,
}));
export const pskLabelEncoder = contramapBufferEncoders([pskIdEncoder, uint16Encoder, uint16Encoder], (label) => [label.id, label.index, label.count]);
export const pskLabelDecoder = mapDecoders([pskIdDecoder, uint16Decoder, uint16Decoder], (id, index, count) => ({ id, index, count }));
export async function computePskSecret(psks, impl) {
    const zeroes = new Uint8Array(impl.kdf.size);
    return psks.reduce(async (acc, [curId, curPsk], index) => updatePskSecret(await acc, curId, curPsk, index, psks.length, impl), Promise.resolve(zeroes));
}
export async function updatePskSecret(secret, pskId, psk, index, count, impl) {
    const zeroes = new Uint8Array(impl.kdf.size);
    return impl.kdf.extract(await expandWithLabel(await impl.kdf.extract(zeroes, psk), "derived psk", encode(pskLabelEncoder, { id: pskId, index, count }), impl.kdf.size, impl.kdf), secret);
}
//# sourceMappingURL=presharedkey.js.map