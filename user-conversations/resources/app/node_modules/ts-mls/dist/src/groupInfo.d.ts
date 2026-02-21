import { Decoder } from "./codec/tlsDecoder.js";
import { Encoder } from "./codec/tlsEncoder.js";
import { CiphersuiteImpl } from "./crypto/ciphersuite.js";
import { Kdf } from "./crypto/kdf.js";
import { Signature } from "./crypto/signature.js";
import { GroupInfoExtension } from "./extension.js";
import { GroupContext } from "./groupContext.js";
import { RatchetTree } from "./ratchetTree.js";
/** @public */
export interface GroupInfoTBS {
    groupContext: GroupContext;
    extensions: GroupInfoExtension[];
    confirmationTag: Uint8Array;
    signer: number;
}
export declare const groupInfoTBSEncoder: Encoder<GroupInfoTBS>;
export declare const groupInfoTBSDecoder: Decoder<GroupInfoTBS>;
/** @public */
export type GroupInfo = GroupInfoTBS & {
    signature: Uint8Array;
};
export declare const groupInfoEncoder: Encoder<GroupInfo>;
export declare const groupInfoDecoder: Decoder<GroupInfo>;
export declare function ratchetTreeFromExtension(info: GroupInfo): RatchetTree | undefined;
export declare function signGroupInfo(tbs: GroupInfoTBS, privateKey: Uint8Array, s: Signature): Promise<GroupInfo>;
export declare function verifyGroupInfoSignature(gi: GroupInfo, publicKey: Uint8Array, s: Signature): Promise<boolean>;
export declare function verifyGroupInfoConfirmationTag(gi: GroupInfo, joinerSecret: Uint8Array, pskSecret: Uint8Array, cs: CiphersuiteImpl): Promise<boolean>;
export declare function extractWelcomeSecret(joinerSecret: Uint8Array, pskSecret: Uint8Array, kdf: Kdf): Promise<Uint8Array<ArrayBufferLike>>;
