const countries:any = require("i18n-iso-countries")
const usStates:any = require('us')
const sugarDate:any = require("sugar").Date

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

export function removeAllWhitespace(str: string) : string {
    return str.replace(/\s/g, "")
}
export function removeNonRomanAlphaNumeric(str: string, keepWhitespace?: boolean) : string {
    if (keepWhitespace) {
        return str.replace(/[^a-zA-Z0-9\s]+/g, "")
    }
    return str.replace(/[^a-zA-Z0-9]+/g, "")
}

export function countryNameTo2Code(name: string, localeString:string = "en"): string {
    return countries.getAlpha2Code(name, localeString)
}

export function usStateNameTo2Code(name: string) : string {
    const stateData = usStates.lookup(name)
    return (stateData && stateData.abbr) || ""
}

export function genderNameToCode(name: string){
    switch (name){
        case "male":
            return "m";
        case "female":
            return "f";
        default:
            return name; // facebook marketing api has no support for other values. just pass whatever the data is!
    }
}

export function getMonth(date: string | number) : string { 
    date = date.toString()
    if(date.length <= 2) { // 01, 5, etc
        return (date + "").padStart(2,"0")
    } 

    try {
        return sugarDate.create(date).format("{MM}") || "" // accepts really wild things like: "January", "Jan", "next wednesday". last ditch effort
    } catch {
        // we don't care about the parsing error
        return ""
    }
    
}
export function getDayOfMonth(date: string | number) : string {
    return (date + "").padStart(2,"0")
}

export function formatFullDate(date: string) {
    try {
        return sugarDate.create(date).format("{yyyy}{MM}{dd}") || ""
    } catch {
        // we don't care about the parsing error
        return ""
    }
}