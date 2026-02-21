import { varLenDataEncoder } from "../codec/variableLength.js";
import { composeBufferEncoders, encode } from "../codec/tlsEncoder.js";
export function encryptWithLabel(publicKey, label, context, plaintext, hpke) {
    const infoEncoder = composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]);
    return hpke.seal(publicKey, plaintext, encode(infoEncoder, [new TextEncoder().encode(`MLS 1.0 ${label}`), context]), new Uint8Array());
}
export function decryptWithLabel(privateKey, label, context, kemOutput, ciphertext, hpke) {
    const infoEncoder = composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]);
    return hpke.open(privateKey, kemOutput, ciphertext, encode(infoEncoder, [new TextEncoder().encode(`MLS 1.0 ${label}`), context]));
}
//# sourceMappingURL=hpke.js.map