import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataEncoder, varLenDataDecoder } from "./codec/variableLength.js";
export const hpkeCiphertextEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder], (egs) => [egs.kemOutput, egs.ciphertext]);
export const hpkeCiphertextDecoder = mapDecoders([varLenDataDecoder, varLenDataDecoder], (kemOutput, ciphertext) => ({ kemOutput, ciphertext }));
//# sourceMappingURL=hpkeCiphertext.js.map