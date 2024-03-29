export interface IntegrationRequiredField {
    /** Matches a field that has this tag. */
    tag: string | null;
    /** If present, supercedes 'tag' and matches a field that has any of the provided tags. */
    any_tag: string[] | null;
    /** If present, supercedes 'tag' and matches a field that has all of the provided tags. */
    all_tags: string[] | null;
}
export interface RequestIntegrationRequiredField {
}
