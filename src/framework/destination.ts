import { Server } from "../server";

import  { DataActionRequest } from './data_action_request';
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
    };
  }

}
