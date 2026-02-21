import { uint16Decoder, uint16Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
/** @public */
export const protocolVersions = {
    mls10: 1,
};
const protocolVersionValues = new Set(Object.values(protocolVersions));
export const protocolVersionEncoder = uint16Encoder;
export const protocolVersionDecoder = mapDecoderOption(uint16Decoder, (v) => protocolVersionValues.has(v) ? v : undefined);
//# sourceMappingURL=protocolVersion.js.map