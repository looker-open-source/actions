import { TokenPayload } from ".";
import { ActionCrypto } from ".";
export declare class EncryptedPayload {
    cid: string;
    payload: string;
    static get crypto(): ActionCrypto;
    static get currentCipherId(): string;
    static encrypt(tokenPayload: TokenPayload, webhookId: string | undefined): Promise<EncryptedPayload>;
    constructor(cid: string, payload: string);
    decrypt(webhookId: string | undefined): Promise<TokenPayload>;
    asJson(): any;
}
