import { Server } from "../server";

import  { DataActionRequest, DataActionType, DataActionFormat } from './data_action_request';
import  { DataActionResponse } from './data_action_response';
import  { DataActionForm } from './data_action_form';

export interface DestinationParameter {
  name : string;
  label : string;
  required : boolean;
  description ?: string;
}

export class Destination {

  public name : string;
  public label : string;
  public description : string;

  public supportedActionTypes : DataActionType[];
  public supportedFormats : DataActionFormat[];

  public params : DestinationParameter[] = [];

  public action : (request : DataActionRequest) => Promise<DataActionResponse>;
  public form : (request : DataActionRequest) => Promise<DataActionForm>;

  public asJson() : any {
    return {
      name: this.name,
      label: this.label,
      description: this.description,
      url: this.action ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/action`) : null,
      form_url: this.form ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/form`) : null,
      params: this.params,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
    };
  }

  async validateAndPerformAction(request : DataActionRequest) {

    if (this.supportedActionTypes.indexOf(request.type) == -1) {
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
