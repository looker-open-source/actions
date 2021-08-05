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