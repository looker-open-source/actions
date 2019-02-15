
export class ActionState {
    data?: string
    refreshTime?: number
    asJson(): any {
        return {data: this.data, refresh_time: this.refreshTime}
    }
}
