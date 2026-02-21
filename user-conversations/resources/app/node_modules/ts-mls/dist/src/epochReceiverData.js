import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataEncoder, varLenDataDecoder } from "./codec/variableLength.js";
import { groupContextEncoder, groupContextDecoder } from "./groupContext.js";
import { ratchetTreeEncoder, ratchetTreeDecoder } from "./ratchetTree.js";
import { secretTreeEncoder, secretTreeDecoder } from "./secretTree.js";
export const epochReceiverDataEncoder = contramapBufferEncoders([varLenDataEncoder, secretTreeEncoder, ratchetTreeEncoder, varLenDataEncoder, groupContextEncoder], (erd) => [erd.resumptionPsk, erd.secretTree, erd.ratchetTree, erd.senderDataSecret, erd.groupContext]);
export const epochReceiverDataDecoder = mapDecoders([varLenDataDecoder, secretTreeDecoder, ratchetTreeDecoder, varLenDataDecoder, groupContextDecoder], (resumptionPsk, secretTree, ratchetTree, senderDataSecret, groupContext) => ({
    resumptionPsk,
    secretTree,
    ratchetTree,
    senderDataSecret,
    groupContext,
}));
//# sourceMappingURL=epochReceiverData.js.map