/** @public */
export declare const defaultCredentialTypes: {
    readonly basic: 1;
    readonly x509: 2;
};
/** @public */
export type DefaultCredentialTypeName = keyof typeof defaultCredentialTypes;
/** @public */
export type DefaultCredentialTypeValue = (typeof defaultCredentialTypes)[DefaultCredentialTypeName];
export declare function isDefaultCredentialTypeValue(v: number): v is DefaultCredentialTypeValue;
