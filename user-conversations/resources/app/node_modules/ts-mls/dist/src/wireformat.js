import { uint16Decoder, uint16Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
import { numberToEnum } from "./util/enumHelpers.js";
/** @public */
export const wireformats = {
    mls_public_message: 1,
    mls_private_message: 2,
    mls_welcome: 3,
    mls_group_info: 4,
    mls_key_package: 5,
};
export const wireformatEncoder = uint16Encoder;
export const wireformatDecoder = mapDecoderOption(uint16Decoder, numberToEnum(wireformats));
//# sourceMappingURL=wireformat.js.map