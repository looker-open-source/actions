const countries: any = require("i18n-iso-countries")
const sugarDate: any = require("sugar").Date

// copy/paste from google. copied so as not to have any cross dependencies
export function sanitizeError(err: any) {
    // Delete redundant properties
    if (err.response && err.response.config && err.config) {
        delete err.response.config
    }

    // Remove headers with sensitive values
    if (err.config && err.config.headers) {
        for (const prop in err.config.headers) {
        if (["developer-token", "Authorization"].includes(prop)) {
            err.config.headers[prop] = "[REDACTED]"
        }
        }
    }

    // Remove data payload - this is hashed but makes the logs unreadable
    if (err.config && err.config.data && err.config.data.operations) {
        err.config.data.operations = "[TRUNCATED]"
    }
    if (err.config && err.config.body) {
        err.config.body = "[TRUNCATED]"
    }
}

export function removeAllWhitespace(str: string): string {
    return str.replace(/\s/g, "")
}
export function removeNonRomanAlphaNumeric(str: string, keepWhitespace?: boolean): string {
    if (keepWhitespace) {
        return str.replace(/[^a-zA-Z0-9\s]+/g, "")
    }
    return str.replace(/[^a-zA-Z0-9]+/g, "")
}

export function countryNameTo2Code(name: string, localeString = "en"): string {
    return countries.getAlpha2Code(name, localeString)
}

export function usStateNameTo2Code(name: string): string {
    if (name.length === 2) {
        return name
    }
    return usStates[name.toLowerCase()] || name
}

export function getMonth(date: string | number): string {
    date = date.toString()
    if (date.length <= 2) { // 01, 5, etc
        return (date + "").padStart(2, "0")
    }

    try {
        return sugarDate.create(date).format("{MM}")
        // accepts really wild things like: "January", "Jan", "next wednesday". last ditch effort
    } catch {
        // we don't care about the parsing error
        return ""
    }

}
export function getDayOfMonth(date: string | number): string {
    return (date + "").padStart(2, "0")
}
export function getYear(date: string | number): string {
    try {
        return sugarDate.create(date).format("{yyyy}")
    } catch {
        // we don't care about the parsing error
        return ""
    }
}

// formatting guide: https://www.facebook.com/business/help/2082575038703844?id=2469097953376494
export function formatFullDate(dayOfMonth: string, month: string, year: string) {
    const formattedDayOfMonth = getDayOfMonth(dayOfMonth);
    const formattedMonth = getMonth(month);
    const formattedYear = getYear(year);
    return `${formattedDayOfMonth}-${formattedMonth}-${formattedYear}` 
}

export function isNullOrUndefined(a: any) {
    if(a === null || a === undefined) {
        return true
    }
}

const usStates: {[key: string]: string} = {
  "alabama": "AL",
  "alaska": "AK",
  "american Samoa": "AS",
  "arizona": "AZ",
  "arkansas": "AR",
  "california": "CA",
  "colorado": "CO",
  "connecticut": "CT",
  "delaware": "DE",
  "district Of Columbia": "DC",
  "federated States Of Micronesia": "FM",
  "florida": "FL",
  "georgia": "GA",
  "guam": "GU",
  "hawaii": "HI",
  "idaho": "ID",
  "illinois": "IL",
  "indiana": "IN",
  "iowa": "IA",
  "kansas": "KS",
  "kentucky": "KY",
  "louisiana": "LA",
  "maine": "ME",
  "marshall Islands": "MH",
  "maryland": "MD",
  "massachusetts": "MA",
  "michigan": "MI",
  "minnesota": "MN",
  "mississippi": "MS",
  "missouri": "MO",
  "montana": "MT",
  "nebraska": "NE",
  "nevada": "NV",
  "new Hampshire": "NH",
  "new Jersey": "NJ",
  "new Mexico": "NM",
  "new York": "NY",
  "north Carolina": "NC",
  "north Dakota": "ND",
  "northern Mariana Islands": "MP",
  "ohio": "OH",
  "oklahoma": "OK",
  "oregon": "OR",
  "palau": "PW",
  "pennsylvania": "PA",
  "puerto Rico": "PR",
  "rhode Island": "RI",
  "south Carolina": "SC",
  "south Dakota": "SD",
  "tennessee": "TN",
  "texas": "TX",
  "utah": "UT",
  "vermont": "VT",
  "virgin Islands": "VI",
  "virginia": "VA",
  "washington": "WA",
  "west Virginia": "WV",
  "wisconsin": "WI",
  "wyoming": "WY",
}
