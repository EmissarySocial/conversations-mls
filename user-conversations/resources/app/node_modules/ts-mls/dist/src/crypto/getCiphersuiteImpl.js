import { ciphersuites } from "./ciphersuite.js";
import { defaultCryptoProvider } from "./implementation/default/provider.js";
/** @public */
export async function getCiphersuiteImpl(cs, provider = defaultCryptoProvider) {
    return provider.getCiphersuiteImpl(ciphersuites[cs]);
}
//# sourceMappingURL=getCiphersuiteImpl.js.map