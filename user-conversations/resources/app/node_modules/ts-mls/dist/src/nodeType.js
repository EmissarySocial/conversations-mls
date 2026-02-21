import { uint8Decoder, uint8Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
import { numberToEnum } from "./util/enumHelpers.js";
/** @public */
export const nodeTypes = {
    leaf: 1,
    parent: 2,
};
export const nodeTypeEncoder = uint8Encoder;
export const nodeTypeDecoder = mapDecoderOption(uint8Decoder, numberToEnum(nodeTypes));
//# sourceMappingURL=nodeType.js.map