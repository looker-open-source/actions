export declare enum LookmlModelExploreFieldTimeIntervalName {
    Day = "day",
    Hour = "hour",
    Minute = "minute",
    Second = "second",
    Millisecond = "millisecond",
    Microsecond = "microsecond",
    Week = "week",
    Month = "month",
    Year = "year"
}
export interface LookmlModelExploreFieldTimeInterval {
    /** The type of time interval this field represents a grouping of. Valid values are: "day", "hour", "minute", "second", "millisecond", "microsecond", "week", "month", "year". */
    name: LookmlModelExploreFieldTimeIntervalName;
    /** The number of intervals this field represents a grouping of. */
    count: number;
}
export interface RequestLookmlModelExploreFieldTimeInterval {
}
