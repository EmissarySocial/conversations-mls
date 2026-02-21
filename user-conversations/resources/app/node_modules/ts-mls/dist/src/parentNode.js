import { uint32Encoder, uint32Decoder } from "./codec/number.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataEncoder, varLenTypeEncoder, varLenDataDecoder, varLenTypeDecoder } from "./codec/variableLength.js";
export const parentNodeEncoder = contramapBufferEncoders([varLenDataEncoder, varLenDataEncoder, varLenTypeEncoder(uint32Encoder)], (node) => [node.hpkePublicKey, node.parentHash, node.unmergedLeaves]);
export const parentNodeDecoder = mapDecoders([varLenDataDecoder, varLenDataDecoder, varLenTypeDecoder(uint32Decoder)], (hpkePublicKey, parentHash, unmergedLeaves) => ({
    hpkePublicKey,
    parentHash,
    unmergedLeaves,
}));
//# sourceMappingURL=parentNode.js.map