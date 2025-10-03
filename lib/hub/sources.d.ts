import { Action } from "./action";
export declare const actions: Action[];
export declare const unfilteredActions: any[];
export declare function addAction(action: Action): void;
export declare function addUnfilteredAction(action: Action): void;
export declare function allActions(opts?: {
    lookerVersion?: string | null;
}): Promise<Action[]>;
export declare function allUnfilteredActions(): Promise<any[]>;
export declare function findAction(id: string, opts?: {
    lookerVersion?: string | null;
}): Promise<Action>;
export declare function findExtendedAction(id: string, opts?: {
    lookerVersion?: string | null;
}): Promise<Action | null>;
