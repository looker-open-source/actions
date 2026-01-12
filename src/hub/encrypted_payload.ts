export class EncryptedPayload {
  constructor(public cid: string, public payload: string) {}

  asJson(): any {
    return {
      cid: this.cid,
      payload: this.payload,
    }
  }
}
