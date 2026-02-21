import { uint8Decoder, uint8Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
import { numberToEnum } from "./util/enumHelpers.js";
/** @public */
export const contentTypes = {
    application: 1,
    proposal: 2,
    commit: 3,
};
export const contentTypeEncoder = uint8Encoder;
export const contentTypeDecoder = mapDecoderOption(uint8Decoder, numberToEnum(contentTypes));
//# sourceMappingURL=contentType.js.map