import { TokenPayload } from ".";
import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto";
export declare class EncryptedPayload {
    cid: string;
    payload: string;
    static get crypto(): ActionCrypto;
    static get currentCipherId(): string;
    static encrypt(tokenPayload: TokenPayload, webhookId: string | undefined): Promise<EncryptedPayload>;
    private static readonly actionCrypto;
    constructor(cid: string, payload: string);
    decrypt(webhookId: string | undefined): Promise<TokenPayload>;
    asJson(): any;
}
