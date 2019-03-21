export interface CryptoProvider {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}
