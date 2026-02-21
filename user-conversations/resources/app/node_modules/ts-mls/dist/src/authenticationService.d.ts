import { Credential } from "./credential.js";
/** @public */
export interface AuthenticationService {
    validateCredential(credential: Credential, signaturePublicKey: Uint8Array): Promise<boolean>;
}
/** @public */
export declare const unsafeTestingAuthenticationService: AuthenticationService;
