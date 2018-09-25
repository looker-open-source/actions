
export class ActionState {
    data?: string
    asJson(): any {
        return {data: this.data}
    }
}
