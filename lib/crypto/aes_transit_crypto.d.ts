import { CryptoProvider } from "./crypto_base";
export declare class AESTransitCrypto implements CryptoProvider {
    ALGORITHM: string;
    HASH_ALGORITHM: string;
    VERSION: number;
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
    cipherId(): string;
}
