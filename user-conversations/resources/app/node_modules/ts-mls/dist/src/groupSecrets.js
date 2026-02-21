import { optionalDecoder, optionalEncoder } from "./codec/optional.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { varLenDataDecoder, varLenTypeDecoder, varLenDataEncoder, varLenTypeEncoder } from "./codec/variableLength.js";
import { pskIdDecoder, pskIdEncoder } from "./presharedkey.js";
export const groupSecretsEncoder = contramapBufferEncoders([varLenDataEncoder, optionalEncoder(varLenDataEncoder), varLenTypeEncoder(pskIdEncoder)], (gs) => [gs.joinerSecret, gs.pathSecret, gs.psks]);
export const groupSecretsDecoder = mapDecoders([varLenDataDecoder, optionalDecoder(varLenDataDecoder), varLenTypeDecoder(pskIdDecoder)], (joinerSecret, pathSecret, psks) => ({ joinerSecret, pathSecret, psks }));
//# sourceMappingURL=groupSecrets.js.map