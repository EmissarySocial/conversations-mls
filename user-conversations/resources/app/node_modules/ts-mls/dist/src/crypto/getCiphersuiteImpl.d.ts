import { CiphersuiteImpl, CiphersuiteName } from "./ciphersuite.js";
import { CryptoProvider } from "./provider.js";
/** @public */
export declare function getCiphersuiteImpl(cs: CiphersuiteName, provider?: CryptoProvider): Promise<CiphersuiteImpl>;
