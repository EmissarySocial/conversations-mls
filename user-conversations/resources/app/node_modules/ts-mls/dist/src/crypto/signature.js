import { composeBufferEncoders, encode } from "../codec/tlsEncoder.js";
import { varLenDataEncoder } from "../codec/variableLength.js";
export async function signWithLabel(signKey, label, content, s) {
    const messageEncoder = composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]);
    return s.sign(signKey, encode(messageEncoder, [new TextEncoder().encode(`MLS 1.0 ${label}`), content]));
}
export async function verifyWithLabel(publicKey, label, content, signature, s) {
    const messageEncoder = composeBufferEncoders([varLenDataEncoder, varLenDataEncoder]);
    return s.verify(publicKey, encode(messageEncoder, [new TextEncoder().encode(`MLS 1.0 ${label}`), content]), signature);
}
//# sourceMappingURL=signature.js.map