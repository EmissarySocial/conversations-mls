import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenDataEncoder } from "./codec/variableLength.js";
import { credentialDecoder, credentialEncoder } from "./credential.js";
export const externalSenderEncoder = contramapBufferEncoders([varLenDataEncoder, credentialEncoder], (e) => [e.signaturePublicKey, e.credential]);
export const externalSenderDecoder = mapDecoders([varLenDataDecoder, credentialDecoder], (signaturePublicKey, credential) => ({ signaturePublicKey, credential }));
//# sourceMappingURL=externalSender.js.map