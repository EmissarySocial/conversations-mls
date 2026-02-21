import { uint16Decoder, uint16Encoder } from "./codec/number.js";
import { mapDecoderOption } from "./codec/tlsDecoder.js";
/** @public */
export const defaultProposalTypes = {
    add: 1,
    update: 2,
    remove: 3,
    psk: 4,
    reinit: 5,
    external_init: 6,
    group_context_extensions: 7,
};
const defaultProposalTypeValues = new Set(Object.values(defaultProposalTypes));
export function isDefaultProposalTypeValue(v) {
    return defaultProposalTypeValues.has(v);
}
export const defaultProposalTypeValueEncoder = uint16Encoder;
export const decodeDefaultProposalTypeValue = mapDecoderOption(uint16Decoder, (v) => defaultProposalTypeValues.has(v) ? v : undefined);
//# sourceMappingURL=defaultProposalType.js.map