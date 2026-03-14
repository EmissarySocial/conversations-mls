/** @public */
export declare function bytesToArrayBuffer(b: Uint8Array): ArrayBuffer;
/** @public */
export declare function toBufferSource(b: Uint8Array): BufferSource;
/** @public */
export declare function bytesToBase64(bytes: Uint8Array): string;
/** @public */
export declare function base64ToBytes(base64: string): Uint8Array;
export declare function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array;
/** @public */
export declare function zeroOutUint8Array(buf: Uint8Array): void;
export declare function fastEqual(a: Uint8Array, b: Uint8Array): boolean;
