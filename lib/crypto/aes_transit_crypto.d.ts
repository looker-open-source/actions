import { CryptoProvider } from "./crypto_base";
export declare class AESTransitCrypto implements CryptoProvider {
    ALGORITHM: string;
    VERSION: number;
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
}
