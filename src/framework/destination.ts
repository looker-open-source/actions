import { Server } from "../server";

import  { DataActionForm } from "./data_action_form";
import  { DataActionFormat, DataActionRequest, DataActionType } from "./data_action_request";
import  { DataActionResponse } from "./data_action_response";

export interface IDestinationParameter {
  name: string;
  label: string;
  required: boolean;
  description?: string;
}

export interface IRequiredField {
  tag: string;
}

export class Destination {

  public name: string;
  public label: string;
  public description: string;

  public supportedActionTypes?: DataActionType[];
  public supportedFormats?: DataActionFormat[];
  public requiredFields: IRequiredField[] = [];

  public params: IDestinationParameter[] = [];

  public action: (request: DataActionRequest) => Promise<DataActionResponse>;
  public form: (request: DataActionRequest) => Promise<DataActionForm>;

  public asJson(): any {
    return {
      description: this.description,
      form_url: this.form ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/form`) : null,
      label: this.label,
      name: this.name,
      params: this.params,
      required_fields: this.requiredFields,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
      url: this.action ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/action`) : null,
    };
  }

  public async validateAndPerformAction(request: DataActionRequest) {

    if (this.supportedActionTypes && this.supportedActionTypes.indexOf(request.type) === -1) {
       throw `This action does not support requests of type "${request.type}".`;
    }

    let requiredParams = this.params.filter((p) => { return p.required; });

    if (requiredParams.length > 0) {
      if (request.params) {
        for (let p of requiredParams) {
          let param = request.params[p.name];
          if (param === undefined || param === null) {
            throw `Required parameter "${p.name}" not provided.`;
          }
        }
      } else {
        throw `No "params" provided but this action has required parameters.`;
      }
    }

    return this.action(request);

  }

}
