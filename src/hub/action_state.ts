
export class ActionState {
    data?: string
    reset?: boolean
    asJson(): any {
        return {data: this.data}
    }
}
