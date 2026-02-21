import { CiphersuiteImpl } from "./crypto/ciphersuite.js";
import { GroupInfo } from "./groupInfo.js";
import { KeyPackage, PrivateKeyPackage } from "./keyPackage.js";
import { MlsMessage } from "./message.js";
import { Proposal } from "./proposal.js";
/** @public */
export declare function proposeAddExternal(groupInfo: GroupInfo, keyPackage: KeyPackage, privateKeyPackage: PrivateKeyPackage, cs: CiphersuiteImpl, authenticatedData?: Uint8Array): Promise<MlsMessage>;
/** @public */
export declare function proposeExternal(groupInfo: GroupInfo, proposal: Proposal, signaturePublicKey: Uint8Array, signaturePrivateKey: Uint8Array, cs: CiphersuiteImpl, authenticatedData?: Uint8Array): Promise<MlsMessage>;
