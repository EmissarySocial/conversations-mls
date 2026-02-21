import { uint8Decoder, uint8Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
/** @public */
export const leafNodeSources = {
    key_package: 1,
    update: 2,
    commit: 3,
};
const leafNodeSourceValues = new Set(Object.values(leafNodeSources));
export const leafNodeSourceValueEncoder = uint8Encoder;
export const leafNodeSourceValueDecoder = mapDecoderOption(uint8Decoder, (v) => leafNodeSourceValues.has(v) ? v : undefined);
//# sourceMappingURL=leafNodeSource.js.map