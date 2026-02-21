import { uint64Encoder, uint64Decoder } from "./codec/number.js";
import { contramapBufferEncoders } from "./codec/tlsEncoder.js";
import { mapDecoders } from "./codec/tlsDecoder.js";
export const lifetimeEncoder = contramapBufferEncoders([uint64Encoder, uint64Encoder], (lt) => [lt.notBefore, lt.notAfter]);
export const lifetimeDecoder = mapDecoders([uint64Decoder, uint64Decoder], (notBefore, notAfter) => ({
    notBefore,
    notAfter,
}));
/** @public */
export function defaultLifetime() {
    const now = Math.floor(Date.now() / 1000);
    return {
        notBefore: BigInt(now - 86400),
        notAfter: BigInt(now + 1314000), // Half month
    };
}
//# sourceMappingURL=lifetime.js.map