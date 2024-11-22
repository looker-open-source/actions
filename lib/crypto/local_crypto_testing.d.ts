/// <reference types="node" />
import { CryptoProvider } from "./crypto_base";
export declare class LocalCryptoTesting implements CryptoProvider {
    ALGORITHM: string;
    INSECURE_IV: Buffer;
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
}
