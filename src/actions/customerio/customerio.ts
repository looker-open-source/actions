import * as util from "util"
import * as winston from "winston"

import { RegionEU, RegionUS, TrackClient } from "customerio-node"
import * as semver from "semver"
import * as Hub from "../../hub"
import {CustomerIoActionError} from "./customerio_error"
// import Regions as cioRegions from "customerio-node/regions"

// import CIO from "customerio-node/track"
// const { TrackClient, RegionUS, RegionEU } = require("customerio-node")

const CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT = 100

async function delayPromiseAll(ms: number) {
    // tslint continually complains about this function, not sure why
    // tslint:disable-next-line
    return new Promise((resolve) => setTimeout(resolve, ms))
}

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
            description: `The maximum number of api calls per second, should be less than:
            ${CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT}`,
            label: "Rate per second limit",
            name: "customer_io_rate_per_second_limit",
            required: false,
            sensitive: false,
        },
    ]
    minimumSupportedLookerVersion = "4.20.0"
    supportedActionTypes = [Hub.ActionType.Query]
    usesStreaming = true
    // extendedAction = true
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
                            {context, created_at: timestamp}),
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
            logger.info(`Start ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`)
            const erroredPromises: any = []
            if (customerIoClient[customerIoCall]) {
            const divider = ratePerSecondLimit
            let promiseArray: any = []
            for (let index = 0; index < batchUpdateObjects.length; index++) {
                promiseArray.push( () => {
                    return customerIoClient[customerIoCall](batchUpdateObjects[index].id,
                        batchUpdateObjects[index].payload).then(() => {
                        winston.debug(`ok`)
                    }).catch(async (err: any) => {
                        winston.warn(`retrying after first ${JSON.stringify(err)}`)
                        winston.warn(`trying to recover ${(index + 1)}`)
                        // await delayPromiseAll(600)
                        erroredPromises.push(batchUpdateObjects[index])
                        customerIoClient[customerIoCall](batchUpdateObjects[index].id,
                            batchUpdateObjects[index].payload).then(() => {
                            erroredPromises.splice(
                                erroredPromises.findIndex( (a: any) => a.id === batchUpdateObjects[index].id) , 1)
                            winston.info(`recovered ${(index + 1)}`)
                            // winston.warn(`remainingMessages: ${batchUpdateObjects.length - (index + 1)}`)
                        }).catch(async (errRetry: any) => {
                            winston.warn(errRetry.message)
                        })
                    })})
                if ( promiseArray.length === divider || index + 1 === batchUpdateObjects.length ) {
                    await Promise.all(promiseArray.map( (promise: any) => promise()))
                    //     .then((arrayOfValuesOrErrors: any) => {
                    //     winston.debug(JSON.stringify(arrayOfValuesOrErrors))
                    // })
                    //     .catch((err) => {
                    //         winston.warn(err.message) // some coding error in handling happened
                    //     })
                    promiseArray = []
                    winston.info(`${index + 1}/${batchUpdateObjects.length}`)
                    await delayPromiseAll(1000)
                }
            }
            logger.info(`Done ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`)
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
                            traits[customKey] = values[key]
                        }
                    }
                }
            }
            if (customerIoFields.emailField && field.name === customerIoFields.emailField.name) {
                traits.email = row[field.name].value
            }
        }
        const id: string | null = customerIoFields.idField ? row[customerIoFields.idField.name].value : null
        const email: string | null = customerIoFields.emailField ? row[customerIoFields.emailField.name].value : null

        const segmentRow: any = {
            id: id || email,
        }
        if (event) {
            context.context.app.looker_sent_at = + context.created_at
            delete context.created_at

            return {...{name: event}, ...{data: {...traits, ... context}, email: traits.email}, ...segmentRow}
        } else {
            return {...traits, ...context, ...segmentRow}
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

        let siteId: string = "" + request.params.customer_io_site_id
        if (request.formParams.customer_io_site_id && request.formParams.customer_io_site_id.length > 0) {
            siteId = request.formParams.customer_io_site_id
        }

        let apiKey: string = "" + request.params.customer_io_api_key
        if (request.formParams.customer_io_api_key && request.formParams.customer_io_api_key.length > 0) {
            apiKey = request.formParams.customer_io_api_key
        }
        return new TrackClient(siteId, apiKey, {region: cioRegion})
        // return new TrackClient(siteId, apiKey, {region: cioRegion, timeout: 120000})
    }

}

Hub.addAction(new CustomerIoAction())
