import { CryptoProvider } from "./crypto_base";
export declare class LocalCryptoTesting implements CryptoProvider {
    ALGORITHM: string;
    INSECURE_IV: Buffer<ArrayBuffer>;
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
    cipherId(): string;
}
