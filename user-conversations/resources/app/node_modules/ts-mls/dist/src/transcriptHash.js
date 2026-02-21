import { mapDecodersOption } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenDataEncoder } from "./codec/variableLength.js";
import { framedContentDecoder, framedContentEncoder } from "./framedContent.js";
import { wireformatDecoder, wireformatEncoder } from "./wireformat.js";
import { contentTypes } from "./contentType.js";
export const confirmedTranscriptHashInputEncoder = contramapBufferEncoders([wireformatEncoder, framedContentEncoder, varLenDataEncoder], (input) => [input.wireformat, input.content, input.signature]);
export const confirmedTranscriptHashInputDecoder = mapDecodersOption([wireformatDecoder, framedContentDecoder, varLenDataDecoder], (wireformat, content, signature) => {
    if (content.contentType === contentTypes.commit)
        return {
            wireformat,
            content,
            signature,
        };
    else
        return undefined;
});
export function createConfirmedHash(interimTranscriptHash, input, hash) {
    const [len, write] = confirmedTranscriptHashInputEncoder(input);
    const buf = new ArrayBuffer(interimTranscriptHash.byteLength + len);
    const arr = new Uint8Array(buf);
    arr.set(interimTranscriptHash, 0);
    write(interimTranscriptHash.byteLength, buf);
    return hash.digest(arr);
}
export function createInterimHash(confirmedHash, confirmationTag, hash) {
    const [len, write] = varLenDataEncoder(confirmationTag);
    const buf = new ArrayBuffer(confirmedHash.byteLength + len);
    const arr = new Uint8Array(buf);
    arr.set(confirmedHash, 0);
    write(confirmedHash.byteLength, buf);
    return hash.digest(arr);
}
//# sourceMappingURL=transcriptHash.js.map