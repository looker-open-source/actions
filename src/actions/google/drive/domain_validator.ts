export class DomainValidator {

  allowedDomains: string[]

  constructor(domainCSV: string) {
    this.allowedDomains = this.parseDomainCSV(domainCSV)
  }

  isValidEmailDomain(email: string) {
    if (this.hasValidDomains() === false) { return true }

    for (const domain of this.allowedDomains) {
      if (email.endsWith(domain)) { return true }
    }
    return false
  }

  hasValidDomains() {
    return this.allowedDomains.length > 0
  }

  private parseDomainCSV(domainCSV: string) {
    // Minimal check to ensure that there is at least one non-whitespace character in the domain
    const domainRegex = /\S+/i

    return domainCSV.split(",")
                    .map((domain) => domain.trim())
                    .filter((domain) => {
                      return domainRegex.test(domain)
                    })
  }
}
