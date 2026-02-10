import { TokenPayload } from ".";
import { ActionCrypto } from ".";
export declare class EncryptedPayload {
    cid: string;
    payload: string;
    private static _crypto;
    private static _currentCipherId;
    static get crypto(): ActionCrypto;
    static get currentCipherId(): string;
    constructor(cid: string, payload: string);
    static encrypt(tokenPayload: TokenPayload, webhookId: string | undefined): Promise<EncryptedPayload>;
    decrypt(webhookId: string | undefined): Promise<TokenPayload>;
    asJson(): any;
}
