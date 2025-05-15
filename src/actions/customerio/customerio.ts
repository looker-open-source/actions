import {RegionEU, RegionUS, TrackClient} from "customerio-node"
import * as https from "https"
import * as semver from "semver"
import * as util from "util"
import * as winston from "winston"
import * as Hub from "../../hub"
import {CustomerIoActionError} from "./customerio_error"

const CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT = 500
const CUSTOMER_IO_UPDATE_DEFAULT_REQUEST_TIMEOUT = 10000
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({timestamp: true}),
    ],
})

interface CustomerIoFields {
    idFieldNames: string[],
    idField?: Hub.Field,
    userIdField?: Hub.Field,
    emailField?: Hub.Field,
}

export enum CustomerIoTags {
    UserId = "user_id",
    Email = "email",
}

export enum CustomerIoCalls {
    Identify = "identify",
    Track = "track",
}

export class CustomerIoAction extends Hub.Action {

    allowedTags = [CustomerIoTags.Email, CustomerIoTags.UserId]

    name = "customerio_identify"
    label = "Customer.io Identify"
    iconName = "customerio/customerio.png"
    description = "Add traits via identify to your customer.io users."
    params = [
        {
            description: "Site id for customer.io",
            label: "Site ID",
            name: "customer_io_site_id",
            required: true,
            sensitive: true,
        },
        {
            description: "Api key for customer.io",
            label: "API Key",
            name: "customer_io_api_key",
            required: true,
            sensitive: true,
        },
        {
            description: "Region for customer.io (could be RegionUS or RegionEU)",
            label: "Region",
            name: "customer_io_region",
            required: true,
            sensitive: false,
        },
        {
            description: `The maximum number of concurrent api calls should be less than:
            ${CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT}`,
            label: "Rate per second limit",
            name: "customer_io_rate_per_second_limit",
            required: false,
            sensitive: false,
        },
        {
            description: `The request timeout for api calls in ms, default value is:
            ${CUSTOMER_IO_UPDATE_DEFAULT_REQUEST_TIMEOUT}ms`,
            label: "Request timeout",
            name: "customer_io_request_timeout",
            required: false,
            sensitive: false,
        },
        {
            description: `Looker customer.io attribute prefix, could be something like looker_`,
            label: "Attribute prefix",
            name: "customer_io_looker_attribute_prefix",
            required: false,
            sensitive: false,
        },
    ]
    minimumSupportedLookerVersion = "4.20.0"
    supportedActionTypes = [Hub.ActionType.Query]
    usesStreaming = true
    extendedAction = true
    supportedFormattings = [Hub.ActionFormatting.Unformatted]
    supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
    requiredFields = [{any_tag: this.allowedTags}]
    executeInOwnProcess = true
    supportedFormats = (request: Hub.ActionRequest) => {
        if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
            return [Hub.ActionFormat.JsonDetailLiteStream]
        } else {
            return [Hub.ActionFormat.JsonDetail]
        }
    }

    async form() {
        const form = new Hub.ActionForm()
        form.fields = [{
            description: "Override default api key",
            label: "Override API Key",
            name: "override_customer_io_api_key",
            required: false,
        }, {
            description: "Override default site id",
            label: "Override Site ID",
            name: "override_customer_io_site_id",
            required: false,
        }]
        return form
    }

    async execute(request: Hub.ActionRequest) {
        return this.executeCustomerIo(request, CustomerIoCalls.Identify)
    }

    protected async executeCustomerIo(request: Hub.ActionRequest, customerIoCall: CustomerIoCalls) {
        const customerIoClient = this.customerIoClientFromRequest(request)
        let ratePerSecondLimit = CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT
        if (request.params.customer_io_rate_per_second_limit) {
            ratePerSecondLimit = +request.params.customer_io_rate_per_second_limit
        }
        let lookerAttributePrefix = ""
        if (request.params.customer_io_looker_attribute_prefix) {
            lookerAttributePrefix = request.params.customer_io_looker_attribute_prefix
        }
        let hiddenFields: string[] = []
        if (request.scheduledPlan &&
            request.scheduledPlan.query &&
            request.scheduledPlan.query.vis_config &&
            request.scheduledPlan.query.vis_config.hidden_fields) {
            hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields
        }

        let customerIoFields: CustomerIoFields | undefined
        let fieldset: Hub.Field[] = []
        const errors: Error[] = []

        const timestamp = Math.round(+new Date() / 1000)
        const context = {
            app: {
                name: "looker/actions",
                version: process.env.APP_VERSION ? process.env.APP_VERSION : "dev",
            },
        }
        const event = request.formParams.event
        const batchUpdateObjects: any = []
        try {

            await request.streamJsonDetail({
                onFields: (fields) => {
                    fieldset = Hub.allFields(fields)
                    customerIoFields = this.customerIoFields(fieldset)
                    this.unassignedCustomerIoFieldsCheck(customerIoFields)
                },
                onRanAt: (iso8601string) => {
                    if (iso8601string) {
                        winston.debug(`${timestamp}`)
                    }
                },
                onRow: (row) => {
                    this.unassignedCustomerIoFieldsCheck(customerIoFields)
                    const payload = {
                        ...this.prepareCustomerIoTraitsFromRow(
                            row, fieldset, customerIoFields!, hiddenFields, event,
                            {context, created_at: timestamp}, lookerAttributePrefix),
                    }
                    try {
                        batchUpdateObjects.push({
                            id: payload.id,
                            payload,
                        })
                    } catch (e) {
                        errors.push(e)
                    }
                },
            })
            logger.debug(`Start ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`)
            const erroredPromises: any = []
            if (customerIoCall in customerIoClient) {
                const divider = ratePerSecondLimit
                let promiseArray: any = []
                for (let index = 0; index < batchUpdateObjects.length; index++) {
                    promiseArray.push(async () => {
                        return customerIoClient[customerIoCall](batchUpdateObjects[index].id,
                            batchUpdateObjects[index].payload).then(() => {
                            winston.debug(`ok`)
                        }).catch(async (err: any) => {
                            winston.debug(`retrying after first ${JSON.stringify(err)}`)
                            winston.debug(`trying to recover ${(index + 1)}`)
                            // await delayPromiseAll(600)
                            erroredPromises.push(batchUpdateObjects[index])
                            customerIoClient[customerIoCall](batchUpdateObjects[index].id,
                                batchUpdateObjects[index].payload).then(() => {
                                erroredPromises.splice(
                                    erroredPromises.findIndex((a: any) => a.id === batchUpdateObjects[index].id), 1)
                                winston.debug(`recovered ${(index + 1)}`)
                            }).catch(async (errRetry: any) => {
                                winston.warn(errRetry.message)
                            })
                        })
                    })
                    if (promiseArray.length === divider || index + 1 === batchUpdateObjects.length) {
                        await Promise.all(promiseArray.map((promise: any) => promise()))
                        promiseArray = []
                        winston.info(`${index + 1}/${batchUpdateObjects.length}`)
                    }
                }
                logger.debug(`Done ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`)
                winston.warn(`errored ${erroredPromises.length}/${batchUpdateObjects.length}`)
            } else {
                const error = `Unable to determine a the api request method for ${customerIoCall}`
                winston.error(error, request.webhookId)
                errors.push(new CustomerIoActionError(`Error: ${error}`))
            }
        } catch (e) {
            errors.push(e)
        }

        if (errors.length > 0) {
            let msg = errors.map((e) => e.message ? e.message : e).join(", ")
            if (msg.length === 0) {
                msg = "An unknown error occurred while processing the customer.io action."
                winston.warn(`Can't format customer.io errors: ${util.inspect(errors)}`)
            }
            return new Hub.ActionResponse({success: false, message: msg})
        } else {
            return new Hub.ActionResponse({success: true})
        }
    }

    protected unassignedCustomerIoFieldsCheck(customerIoFields: CustomerIoFields | undefined) {
        if (!(customerIoFields && customerIoFields.idFieldNames.length > 0)) {
            throw new CustomerIoActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
        }
    }

    protected taggedFields(fields: Hub.Field[], tags: string[]) {
        return fields.filter((f) =>
            f.tags && f.tags.length > 0 && f.tags.some((t: string) => tags.indexOf(t) !== -1),
        )
    }

    protected taggedField(fields: any[], tags: string[]): Hub.Field | undefined {
        return this.taggedFields(fields, tags)[0]
    }

    protected customerIoFields(fields: Hub.Field[]): CustomerIoFields {
        const idFieldNames = this.taggedFields(fields, [
            CustomerIoTags.Email,
            CustomerIoTags.UserId,
        ]).map((f: Hub.Field) => (f.name))

        return {
            idFieldNames,
            idField: this.taggedField(fields, [CustomerIoTags.UserId]),
            userIdField: this.taggedField(fields, [CustomerIoTags.UserId]),
            emailField: this.taggedField(fields, [CustomerIoTags.Email]),
        }
    }

    // Removes JsonDetail Cell metadata and only sends relevant nested data to Segment
    // See JsonDetail.ts to see structure of a JsonDetail Row
    protected filterJsonCustomerIo(jsonRow: any, customerIoFields: CustomerIoFields, fieldName: string) {
        const pivotValues: any = {}
        pivotValues[fieldName] = []
        const filterFunctionCustomerIo = (currentObject: any, name: string) => {
            const returnVal: any = {}
            if (Object(currentObject) === currentObject) {
                for (const key in currentObject) {
                    if (currentObject.hasOwnProperty(key)) {
                        if (key === "value") {
                            returnVal[name] = currentObject[key]
                            return returnVal
                        } else if (customerIoFields.idFieldNames.indexOf(key) === -1) {
                            const res = filterFunctionCustomerIo(currentObject[key], key)
                            if (res !== {}) {
                                pivotValues[fieldName].push(res)
                            }
                        }
                    }
                }
            }
            return returnVal
        }
        filterFunctionCustomerIo(jsonRow, fieldName)
        return pivotValues
    }

    protected prepareCustomerIoTraitsFromRow(
        row: Hub.JsonDetail.Row,
        fields: Hub.Field[],
        customerIoFields: CustomerIoFields,
        hiddenFields: string[],
        event: any,
        context: any,
        lookerAttributePrefix: string,
    ) {
        const traits: { [key: string]: string } = {}
        for (const field of fields) {
            if (customerIoFields.idFieldNames.indexOf(field.name) === -1) {
                if (hiddenFields.indexOf(field.name) === -1) {
                    let values: any = {}
                    if (!row.hasOwnProperty(field.name)) {
                        winston.error("Field name does not exist for customer.io action")
                        throw new CustomerIoActionError(`Field id ${field.name} does not exist for JsonDetail.Row`)
                    }
                    if (row[field.name].value || row[field.name].value === 0) {
                        values[field.name] = row[field.name].value
                    } else {
                        values = this.filterJsonCustomerIo(row[field.name], customerIoFields, field.name)
                    }
                    for (const key in values) {
                        if (values.hasOwnProperty(key)) {
                            const customKey = key.indexOf(".") >= 0 ? key.split(".")[1] : key
                            traits[lookerAttributePrefix + customKey] = values[key]
                        }
                    }
                }
            }
            if (customerIoFields.emailField && field.name === customerIoFields.emailField.name && row[field.name]) {
                traits.email = row[field.name].value
            }
        }
        const id: string | null = customerIoFields.idField ? row[customerIoFields.idField.name].value : null
        const email: string | null = customerIoFields.emailField && customerIoFields.emailField.name in row
            ? row[customerIoFields.emailField.name].value : null

        const segmentRow: any = {
            id: id || email,
        }
        context.context.app.looker_sent_at = +context.created_at
        delete context.created_at
        if (event) {
            return {...{name: event}, ...{data: {...traits, ...context}, email: traits.email}, ...segmentRow}
        } else {
            return {...traits, ...context, ...segmentRow, _update: true}
        }
    }

    protected customerIoClientFromRequest(request: Hub.ActionRequest) {
        let cioRegion = RegionUS
        switch (request.params.customer_io_region) {
            case "RegionUS":
                cioRegion = RegionUS
                break
            case "RegionEU":
                cioRegion = RegionEU
                break
            default:
                throw new CustomerIoActionError(`Customer.io requires a valig region (RegionUS or RegionEU)`)
        }
        let requestTimeout = CUSTOMER_IO_UPDATE_DEFAULT_REQUEST_TIMEOUT
        if (request.params.customer_io_request_timeout) {
            requestTimeout = +request.params.customer_io_request_timeout
        }
        let siteId: string = "" + request.params.customer_io_site_id
        if (request.formParams.customer_io_site_id && request.formParams.customer_io_site_id.length > 0) {
            siteId = request.formParams.customer_io_site_id
        }
        let apiKey: string = "" + request.params.customer_io_api_key
        if (request.formParams.customer_io_api_key && request.formParams.customer_io_api_key.length > 0) {
            apiKey = request.formParams.customer_io_api_key
        }
        const keepAliveAgent = new https.Agent({ keepAlive: true })
        return new TrackClient(siteId, apiKey, {
            region: cioRegion, timeout: requestTimeout,
            agent: keepAliveAgent,
        })
    }

}

Hub.addAction(new CustomerIoAction())
