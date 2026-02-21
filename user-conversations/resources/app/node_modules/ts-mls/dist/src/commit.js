import { optionalDecoder, optionalEncoder } from "./codec/optional.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenTypeDecoder, varLenTypeEncoder } from "./codec/variableLength.js";
import { proposalOrRefDecoder, proposalOrRefEncoder } from "./proposalOrRefType.js";
import { updatePathDecoder, updatePathEncoder } from "./updatePath.js";
export const commitEncoder = contramapBufferEncoders([varLenTypeEncoder(proposalOrRefEncoder), optionalEncoder(updatePathEncoder)], (commit) => [commit.proposals, commit.path]);
export const commitDecoder = mapDecoders([varLenTypeDecoder(proposalOrRefDecoder), optionalDecoder(updatePathDecoder)], (proposals, path) => ({ proposals, path }));
//# sourceMappingURL=commit.js.map