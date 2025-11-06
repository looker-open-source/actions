export class ActionToken {
  constructor(public tokens: any, public redirect: any) {}

  asJson(): any {
    return {
      tokens: this.tokens,
      redirect: this.redirect,
    }
  }
}
