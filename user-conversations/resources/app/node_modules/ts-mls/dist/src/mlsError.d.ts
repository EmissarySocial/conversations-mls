/** @public */
export declare class MlsError extends Error {
    constructor(message: string);
}
/** @public */
export declare class ValidationError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class CodecError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class UsageError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class DependencyError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class CryptoVerificationError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class CryptoError extends MlsError {
    constructor(message: string);
}
/** @public */
export declare class InternalError extends MlsError {
    constructor(message: string);
}
