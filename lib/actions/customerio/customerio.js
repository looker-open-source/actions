"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerIoAction = exports.CustomerIoCalls = exports.CustomerIoTags = void 0;
const customerio_node_1 = require("customerio-node");
const https = require("https");
const semver = require("semver");
const util = require("util");
const winston = require("winston");
const Hub = require("../../hub");
const customerio_error_1 = require("./customerio_error");
const CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT = 500;
const CUSTOMER_IO_UPDATE_DEFAULT_REQUEST_TIMEOUT = 10000;
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ timestamp: true }),
    ],
});
var CustomerIoTags;
(function (CustomerIoTags) {
    CustomerIoTags["UserId"] = "user_id";
    CustomerIoTags["Email"] = "email";
})(CustomerIoTags = exports.CustomerIoTags || (exports.CustomerIoTags = {}));
var CustomerIoCalls;
(function (CustomerIoCalls) {
    CustomerIoCalls["Identify"] = "identify";
    CustomerIoCalls["Track"] = "track";
})(CustomerIoCalls = exports.CustomerIoCalls || (exports.CustomerIoCalls = {}));
class CustomerIoAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.allowedTags = [CustomerIoTags.Email, CustomerIoTags.UserId];
        this.name = "customerio_identify";
        this.label = "Customer.io Identify";
        this.iconName = "customerio/customerio.png";
        this.description = "Add traits via identify to your customer.io users.";
        this.params = [
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
        ];
        this.minimumSupportedLookerVersion = "4.20.0";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.extendedAction = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.requiredFields = [{ any_tag: this.allowedTags }];
        this.executeInOwnProcess = true;
        this.supportedFormats = (request) => {
            if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
                return [Hub.ActionFormat.JsonDetailLiteStream];
            }
            else {
                return [Hub.ActionFormat.JsonDetail];
            }
        };
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
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
                }];
            return form;
        });
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeCustomerIo(request, CustomerIoCalls.Identify);
        });
    }
    executeCustomerIo(request, customerIoCall) {
        return __awaiter(this, void 0, void 0, function* () {
            const customerIoClient = this.customerIoClientFromRequest(request);
            let ratePerSecondLimit = CUSTOMER_IO_UPDATE_DEFAULT_RATE_PER_SECOND_LIMIT;
            if (request.params.customer_io_rate_per_second_limit) {
                ratePerSecondLimit = +request.params.customer_io_rate_per_second_limit;
            }
            let lookerAttributePrefix = "";
            if (request.params.customer_io_looker_attribute_prefix) {
                lookerAttributePrefix = request.params.customer_io_looker_attribute_prefix;
            }
            let hiddenFields = [];
            if (request.scheduledPlan &&
                request.scheduledPlan.query &&
                request.scheduledPlan.query.vis_config &&
                request.scheduledPlan.query.vis_config.hidden_fields) {
                hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
            }
            let customerIoFields;
            let fieldset = [];
            const errors = [];
            const timestamp = Math.round(+new Date() / 1000);
            const context = {
                app: {
                    name: "looker/actions",
                    version: process.env.APP_VERSION ? process.env.APP_VERSION : "dev",
                },
            };
            const event = request.formParams.event;
            const batchUpdateObjects = [];
            try {
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        fieldset = Hub.allFields(fields);
                        customerIoFields = this.customerIoFields(fieldset);
                        this.unassignedCustomerIoFieldsCheck(customerIoFields);
                    },
                    onRanAt: (iso8601string) => {
                        if (iso8601string) {
                            winston.debug(`${timestamp}`);
                        }
                    },
                    onRow: (row) => {
                        this.unassignedCustomerIoFieldsCheck(customerIoFields);
                        const payload = Object.assign({}, this.prepareCustomerIoTraitsFromRow(row, fieldset, customerIoFields, hiddenFields, event, { context, created_at: timestamp }, lookerAttributePrefix));
                        try {
                            batchUpdateObjects.push({
                                id: payload.id,
                                payload,
                            });
                        }
                        catch (e) {
                            errors.push(e);
                        }
                    },
                });
                logger.debug(`Start ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`);
                const erroredPromises = [];
                if (customerIoCall in customerIoClient) {
                    const divider = ratePerSecondLimit;
                    let promiseArray = [];
                    for (let index = 0; index < batchUpdateObjects.length; index++) {
                        promiseArray.push(() => __awaiter(this, void 0, void 0, function* () {
                            return customerIoClient[customerIoCall](batchUpdateObjects[index].id, batchUpdateObjects[index].payload).then(() => {
                                winston.debug(`ok`);
                            }).catch((err) => __awaiter(this, void 0, void 0, function* () {
                                winston.debug(`retrying after first ${JSON.stringify(err)}`);
                                winston.debug(`trying to recover ${(index + 1)}`);
                                // await delayPromiseAll(600)
                                erroredPromises.push(batchUpdateObjects[index]);
                                customerIoClient[customerIoCall](batchUpdateObjects[index].id, batchUpdateObjects[index].payload).then(() => {
                                    erroredPromises.splice(erroredPromises.findIndex((a) => a.id === batchUpdateObjects[index].id), 1);
                                    winston.debug(`recovered ${(index + 1)}`);
                                }).catch((errRetry) => __awaiter(this, void 0, void 0, function* () {
                                    winston.warn(errRetry.message);
                                }));
                            }));
                        }));
                        if (promiseArray.length === divider || index + 1 === batchUpdateObjects.length) {
                            yield Promise.all(promiseArray.map((promise) => promise()));
                            promiseArray = [];
                            winston.info(`${index + 1}/${batchUpdateObjects.length}`);
                        }
                    }
                    logger.debug(`Done ${batchUpdateObjects.length} for ${ratePerSecondLimit} ratePerSecondLimit`);
                    winston.warn(`errored ${erroredPromises.length}/${batchUpdateObjects.length}`);
                }
                else {
                    const error = `Unable to determine a the api request method for ${customerIoCall}`;
                    winston.error(error, request.webhookId);
                    errors.push(new customerio_error_1.CustomerIoActionError(`Error: ${error}`));
                }
            }
            catch (e) {
                errors.push(e);
            }
            if (errors.length > 0) {
                let msg = errors.map((e) => e.message ? e.message : e).join(", ");
                if (msg.length === 0) {
                    msg = "An unknown error occurred while processing the customer.io action.";
                    winston.warn(`Can't format customer.io errors: ${util.inspect(errors)}`);
                }
                return new Hub.ActionResponse({ success: false, message: msg });
            }
            else {
                return new Hub.ActionResponse({ success: true });
            }
        });
    }
    unassignedCustomerIoFieldsCheck(customerIoFields) {
        if (!(customerIoFields && customerIoFields.idFieldNames.length > 0)) {
            throw new customerio_error_1.CustomerIoActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`);
        }
    }
    taggedFields(fields, tags) {
        return fields.filter((f) => f.tags && f.tags.length > 0 && f.tags.some((t) => tags.indexOf(t) !== -1));
    }
    taggedField(fields, tags) {
        return this.taggedFields(fields, tags)[0];
    }
    customerIoFields(fields) {
        const idFieldNames = this.taggedFields(fields, [
            CustomerIoTags.Email,
            CustomerIoTags.UserId,
        ]).map((f) => (f.name));
        return {
            idFieldNames,
            idField: this.taggedField(fields, [CustomerIoTags.UserId]),
            userIdField: this.taggedField(fields, [CustomerIoTags.UserId]),
            emailField: this.taggedField(fields, [CustomerIoTags.Email]),
        };
    }
    // Removes JsonDetail Cell metadata and only sends relevant nested data to Segment
    // See JsonDetail.ts to see structure of a JsonDetail Row
    filterJsonCustomerIo(jsonRow, customerIoFields, fieldName) {
        const pivotValues = {};
        pivotValues[fieldName] = [];
        const filterFunctionCustomerIo = (currentObject, name) => {
            const returnVal = {};
            if (Object(currentObject) === currentObject) {
                for (const key in currentObject) {
                    if (currentObject.hasOwnProperty(key)) {
                        if (key === "value") {
                            returnVal[name] = currentObject[key];
                            return returnVal;
                        }
                        else if (customerIoFields.idFieldNames.indexOf(key) === -1) {
                            const res = filterFunctionCustomerIo(currentObject[key], key);
                            if (res !== {}) {
                                pivotValues[fieldName].push(res);
                            }
                        }
                    }
                }
            }
            return returnVal;
        };
        filterFunctionCustomerIo(jsonRow, fieldName);
        return pivotValues;
    }
    prepareCustomerIoTraitsFromRow(row, fields, customerIoFields, hiddenFields, event, context, lookerAttributePrefix) {
        const traits = {};
        for (const field of fields) {
            if (customerIoFields.idFieldNames.indexOf(field.name) === -1) {
                if (hiddenFields.indexOf(field.name) === -1) {
                    let values = {};
                    if (!row.hasOwnProperty(field.name)) {
                        winston.error("Field name does not exist for customer.io action");
                        throw new customerio_error_1.CustomerIoActionError(`Field id ${field.name} does not exist for JsonDetail.Row`);
                    }
                    if (row[field.name].value || row[field.name].value === 0) {
                        values[field.name] = row[field.name].value;
                    }
                    else {
                        values = this.filterJsonCustomerIo(row[field.name], customerIoFields, field.name);
                    }
                    for (const key in values) {
                        if (values.hasOwnProperty(key)) {
                            const customKey = key.indexOf(".") >= 0 ? key.split(".")[1] : key;
                            traits[lookerAttributePrefix + customKey] = values[key];
                        }
                    }
                }
            }
            if (customerIoFields.emailField && field.name === customerIoFields.emailField.name && row[field.name]) {
                traits.email = row[field.name].value;
            }
        }
        const id = customerIoFields.idField ? row[customerIoFields.idField.name].value : null;
        const email = customerIoFields.emailField && customerIoFields.emailField.name in row
            ? row[customerIoFields.emailField.name].value : null;
        const segmentRow = {
            id: id || email,
        };
        context.context.app.looker_sent_at = +context.created_at;
        delete context.created_at;
        if (event) {
            return Object.assign(Object.assign({ name: event }, { data: Object.assign(Object.assign({}, traits), context), email: traits.email }), segmentRow);
        }
        else {
            return Object.assign(Object.assign(Object.assign(Object.assign({}, traits), context), segmentRow), { _update: true });
        }
    }
    customerIoClientFromRequest(request) {
        let cioRegion = customerio_node_1.RegionUS;
        switch (request.params.customer_io_region) {
            case "RegionUS":
                cioRegion = customerio_node_1.RegionUS;
                break;
            case "RegionEU":
                cioRegion = customerio_node_1.RegionEU;
                break;
            default:
                throw new customerio_error_1.CustomerIoActionError(`Customer.io requires a valig region (RegionUS or RegionEU)`);
        }
        let requestTimeout = CUSTOMER_IO_UPDATE_DEFAULT_REQUEST_TIMEOUT;
        if (request.params.customer_io_request_timeout) {
            requestTimeout = +request.params.customer_io_request_timeout;
        }
        let siteId = "" + request.params.customer_io_site_id;
        if (request.formParams.customer_io_site_id && request.formParams.customer_io_site_id.length > 0) {
            siteId = request.formParams.customer_io_site_id;
        }
        let apiKey = "" + request.params.customer_io_api_key;
        if (request.formParams.customer_io_api_key && request.formParams.customer_io_api_key.length > 0) {
            apiKey = request.formParams.customer_io_api_key;
        }
        const keepAliveAgent = new https.Agent({ keepAlive: true });
        return new customerio_node_1.TrackClient(siteId, apiKey, {
            region: cioRegion, timeout: requestTimeout,
            agent: keepAliveAgent,
        });
    }
}
exports.CustomerIoAction = CustomerIoAction;
Hub.addAction(new CustomerIoAction());
