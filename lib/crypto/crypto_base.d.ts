export interface CryptoProvider {
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string, cipherId?: string): Promise<string>;
    cipherId(): string;
}
