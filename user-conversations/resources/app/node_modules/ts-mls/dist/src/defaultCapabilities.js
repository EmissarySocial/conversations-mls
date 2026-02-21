import { defaultCredentialTypes } from "./defaultCredentialType.js";
import { ciphersuites } from "./crypto/ciphersuite.js";
import { greaseCapabilities, defaultGreaseConfig } from "./grease.js";
import { protocolVersions } from "./protocolVersion.js";
/** @public */
export function defaultCapabilities() {
    return greaseCapabilities(defaultGreaseConfig, {
        versions: [protocolVersions.mls10],
        ciphersuites: Object.values(ciphersuites),
        extensions: [],
        proposals: [],
        credentials: Object.values(defaultCredentialTypes),
    });
}
//# sourceMappingURL=defaultCapabilities.js.map