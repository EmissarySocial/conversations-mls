import { flatMapDecoder, mapDecoder, mapDecoders } from "./codec/tlsDecoder.js";
import { contramapBufferEncoders, encode } from "./codec/tlsEncoder.js";
import { refhash } from "./crypto/hash.js";
import { framedContentDecoder, framedContentAuthDataDecoder, framedContentEncoder, framedContentAuthDataEncoder, framedContentTBSEncoder, } from "./framedContent.js";
import { wireformatDecoder, wireformatEncoder } from "./wireformat.js";
export const authenticatedContentEncoder = contramapBufferEncoders([wireformatEncoder, framedContentEncoder, framedContentAuthDataEncoder], (a) => [a.wireformat, a.content, a.auth]);
export const authenticatedContentDecoder = mapDecoders([
    wireformatDecoder,
    flatMapDecoder(framedContentDecoder, (content) => {
        return mapDecoder(framedContentAuthDataDecoder(content.contentType), (auth) => ({ content, auth }));
    }),
], (wireformat, contentAuth) => ({
    wireformat,
    ...contentAuth,
}));
const authenticatedContentTBMEncoder = contramapBufferEncoders([framedContentTBSEncoder, framedContentAuthDataEncoder], (t) => [t.contentTbs, t.auth]);
export function createMembershipTag(membershipKey, tbm, h) {
    return h.mac(membershipKey, encode(authenticatedContentTBMEncoder, tbm));
}
export function verifyMembershipTag(membershipKey, tbm, tag, h) {
    return h.verifyMac(membershipKey, tag, encode(authenticatedContentTBMEncoder, tbm));
}
export function makeProposalRef(proposal, h) {
    return refhash("MLS 1.0 Proposal Reference", encode(authenticatedContentEncoder, proposal), h);
}
//# sourceMappingURL=authenticatedContent.js.map