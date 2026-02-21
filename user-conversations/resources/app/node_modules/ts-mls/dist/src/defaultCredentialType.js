/** @public */
export const defaultCredentialTypes = {
    basic: 1,
    x509: 2,
};
const defaultCredentialTypeValues = new Set(Object.values(defaultCredentialTypes));
export function isDefaultCredentialTypeValue(v) {
    return defaultCredentialTypeValues.has(v);
}
//# sourceMappingURL=defaultCredentialType.js.map