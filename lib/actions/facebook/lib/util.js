"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeError = sanitizeError;
exports.removeAllWhitespace = removeAllWhitespace;
exports.removeNonRomanAlphaNumeric = removeNonRomanAlphaNumeric;
exports.countryNameTo2Code = countryNameTo2Code;
exports.usStateNameTo2Code = usStateNameTo2Code;
exports.getMonth = getMonth;
exports.getDayOfMonth = getDayOfMonth;
exports.getYear = getYear;
exports.formatFullDate = formatFullDate;
exports.isNullOrUndefined = isNullOrUndefined;
exports.sortCompare = sortCompare;
const countries = require("i18n-iso-countries");
const sugarDate = require("sugar").Date;
// copy/paste from google. copied so as not to have any cross dependencies
function sanitizeError(err) {
    // Delete redundant properties
    if (err.response && err.response.config && err.config) {
        delete err.response.config;
    }
    // Remove headers with sensitive values
    if (err.config && err.config.headers) {
        for (const prop in err.config.headers) {
            if (["developer-token", "Authorization"].includes(prop)) {
                err.config.headers[prop] = "[REDACTED]";
            }
        }
    }
    // Remove data payload - this is hashed but makes the logs unreadable
    if (err.config && err.config.data && err.config.data.operations) {
        err.config.data.operations = "[TRUNCATED]";
    }
    if (err.config && err.config.body) {
        err.config.body = "[TRUNCATED]";
    }
}
function removeAllWhitespace(str) {
    return str.replace(/\s/g, "");
}
function removeNonRomanAlphaNumeric(str, keepWhitespace) {
    if (keepWhitespace) {
        return str.replace(/[^a-zA-Z0-9\s]+/g, "");
    }
    return str.replace(/[^a-zA-Z0-9]+/g, "");
}
function countryNameTo2Code(name, localeString = "en") {
    return countries.getAlpha2Code(name, localeString);
}
function usStateNameTo2Code(name) {
    if (name.length === 2) {
        return name;
    }
    return usStates[name.toLowerCase()] || name;
}
function getMonth(date) {
    date = date.toString();
    if (date.length <= 2) { // 01, 5, etc
        return (date + "").padStart(2, "0");
    }
    try {
        sugarDate.extend();
        return sugarDate.create(date).format("{MM}");
        // accepts really wild things like: "January", "Jan", "next wednesday". last ditch effort
    }
    catch (_a) {
        // we don't care about the parsing error
        return "";
    }
}
function getDayOfMonth(date) {
    return (date + "").padStart(2, "0");
}
function getYear(date) {
    try {
        return sugarDate.create(date).format("{yyyy}");
    }
    catch (_a) {
        // we don't care about the parsing error
        return "";
    }
}
// formatting guide: https://www.facebook.com/business/help/2082575038703844?id=2469097953376494
function formatFullDate(dayOfMonth, month, year) {
    const formattedDayOfMonth = getDayOfMonth(dayOfMonth);
    const formattedMonth = getMonth(month);
    const formattedYear = getYear(year);
    return `${formattedDayOfMonth}-${formattedMonth}-${formattedYear}`;
}
function isNullOrUndefined(a) {
    if (a === null || a === undefined) {
        return true;
    }
}
function sortCompare(a, b) {
    if (a.name < b.name) {
        return -1;
    }
    if (a.name > b.name) {
        return 1;
    }
    return 0;
}
const usStates = {
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
};
