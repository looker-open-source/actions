import * as util from "util";
import * as winston from "winston";
import * as hubspot from "@hubspot/api-client";
import * as semver from "semver";
import * as Hub from "../../hub";
import { HubspotActionError } from "./hubspot_error";
import { IncomingMessage } from "http";

// import { HubspotActionError } from "./hubspot_error";

export enum HubspotTags {
  ContactId = "hubspot_contact_id",
  CompanyId = "hubspot_company_id",
}

export enum HubspotCalls {
  Contact = "contact",
  Company = "company",
}

interface DefaultHubspotConstructorProps {
  name: string;
  label: string;
  description: string;
  call: HubspotCalls;
  tag: HubspotTags;
}

interface DefaultHubspotAction extends DefaultHubspotConstructorProps {}

export class HubspotAction extends Hub.Action implements DefaultHubspotAction {
  name: string;
  label: string;
  description: string;
  call: HubspotCalls;
  tag: HubspotTags;

  allowedTags = [HubspotTags.ContactId, HubspotTags.CompanyId];
  iconName = "hubspot/hubspot.png";
  params = [
    {
      description: "An api key for Hubspot.",
      label: "Hubspot API Key",
      name: "hubspot_api_key",
      required: true,
      sensitive: true,
    },
  ];
  minimumSupportedLookerVersion = "4.20.0";
  supportedActionTypes = [Hub.ActionType.Query];
  usesStreaming = true;
  supportedFormattings = [Hub.ActionFormatting.Unformatted];
  supportedVisualizationFormattings = [
    Hub.ActionVisualizationFormatting.Noapply,
  ];
  requiredFields = [{ any_tag: this.allowedTags }];
  executeInOwnProcess = true;
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream];
    } else {
      return [Hub.ActionFormat.JsonDetail];
    }
  };

  constructor({
    name,
    label,
    description,
    call,
    tag,
  }: DefaultHubspotConstructorProps) {
    super();
    this.name = name;
    this.label = label;
    this.description = description;
    this.call = call;
    this.tag = tag;
  }

  protected hubspotClientFromRequest(request: Hub.ActionRequest) {
    return new hubspot.Client({ apiKey: request.params.hubspot_api_key });
  }

  async execute(request: Hub.ActionRequest) {
    return this.executeHubspot(request, this.call);
  }

  protected taggedFields(fields: Hub.Field[], tags: string[]) {
    return fields.filter(
      (f) =>
        f.tags &&
        f.tags.length > 0 &&
        f.tags.some((t: string) => tags.indexOf(t) !== -1)
    );
  }

  protected getHubspotIdFieldName(fieldset: Hub.Field[]): string | undefined {
    let fieldName: string | undefined;
    fieldset.forEach((field) => {
      if (
        field.tags &&
        field.tags.length > 0 &&
        field.tags.includes(this.tag)
      ) {
        fieldName = field.name;
      }
    });
    return fieldName;
  }

  /**
   * Returns the hubspot ID from the current row, given that one of the column dimensions
   * was tagged with the corresponding HubspotTag
   * @param fieldset Fieldset for the entire query
   * @param row The specific row to be processed
   */
  protected getHubspotIdFromRow(
    fieldset: Hub.Field[],
    row: Hub.JsonDetail.Row
  ): string | undefined {
    const hubspotIdFieldName = this.getHubspotIdFieldName(fieldset);
    if (!hubspotIdFieldName) return undefined;
    for (const field of fieldset) {
      if (field.name === hubspotIdFieldName) {
        return row[hubspotIdFieldName].value;
      }
    }
  }

  protected async executeHubspot(
    request: Hub.ActionRequest,
    hubspotCall: HubspotCalls
  ) {
    const hubspotClient = await this.hubspotClientFromRequest(request);
    console.log("I am executing the hubspot call: ", hubspotCall);

    let hiddenFields: string[] = [];
    if (
      request.scheduledPlan &&
      request.scheduledPlan.query &&
      request.scheduledPlan.query.vis_config &&
      request.scheduledPlan.query.vis_config.hidden_fields
    ) {
      hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
    }

    console.log("Hide fields: ", hiddenFields);

    let hubspotIdFieldName: string | undefined;
    let batchUpdateObjects: hubspot.contactsModels.SimplePublicObjectBatchInput[] = [];
    let fieldset: Hub.Field[] = [];
    const errors: Error[] = [];

    let timestamp = new Date();
    console.log("The timestamp is: ", timestamp);
    const context = {
      app: {
        name: "looker/actions",
        version: process.env.APP_VERSION ? process.env.APP_VERSION : "dev",
      },
    };
    const event = request.formParams.event;

    console.log("Context: ", context);
    console.log("Event: ", event);

    try {
      await request.streamJsonDetail({
        onFields: (fields) => {
          fieldset = Hub.allFields(fields);
          hubspotIdFieldName = this.getHubspotIdFieldName(fieldset);
          if (!hubspotIdFieldName) {
            const error = `Dimension with the ${this.tag} tag is required`;
            winston.error(error);
            throw new HubspotActionError(error);
          }
        },
        onRow: (row: Hub.JsonDetail.Row) => {
          const hubspotId = this.getHubspotIdFromRow(fieldset, row);
          if (hubspotId) {
            console.log(`${hubspotId}: Row`, row);
            const entries = Object.entries(row);
            let properties: { [key: string]: string } = {};
            entries.forEach(([fieldName, fieldSet]) => {
              if (fieldName !== hubspotIdFieldName) {
                properties[fieldName] = fieldSet.value;
              }
            });

            // Append id and properties to batch update
            try {
              batchUpdateObjects.push({
                id: hubspotId,
                properties,
              });
            } catch (e) {
              errors.push(e);
            }
          }
        },
      });

      console.log("Batch updates: ", batchUpdateObjects);
      let hubspotBatchUpdateRequest:
        | Promise<{
            response: IncomingMessage;
            body: hubspot.contactsModels.BatchResponseSimplePublicObject;
          }>
        | undefined;
      switch (this.call) {
        case HubspotCalls.Contact:
          hubspotBatchUpdateRequest = hubspotClient.crm.contacts.batchApi.update(
            {
              inputs: batchUpdateObjects,
            }
          );
          break;
        case HubspotCalls.Company:
          hubspotBatchUpdateRequest = hubspotClient.crm.companies.batchApi.update(
            {
              inputs: batchUpdateObjects,
            }
          );
        default:
          break;
      }
      await hubspotBatchUpdateRequest;
    } catch (e) {
      errors.push(e);
    }

    if (errors.length > 0) {
      let msg = errors.map((e) => (e.message ? e.message : e)).join(", ");
      if (msg.length === 0) {
        msg = "An unknown error occurred while processing the Hubspot action.";
        winston.warn(`Can't format Hubspot errors: ${util.inspect(errors)}`);
      }
      return new Hub.ActionResponse({ success: false, message: msg });
    } else {
      return new Hub.ActionResponse({ success: true });
    }
  }
}
