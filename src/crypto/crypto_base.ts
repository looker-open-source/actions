export abstract class CryptoBase {
  abstract async encrypt(plaintext: string): Promise<string>
  abstract async decrypt(ciphertext: string): Promise<string>
}
