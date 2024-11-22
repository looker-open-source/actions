export declare class DomainValidator {
    allowedDomains: string[];
    constructor(domainCSV: string);
    isValidEmailDomain(email: string): boolean;
    hasValidDomains(): boolean;
    private parseDomainCSV;
}
