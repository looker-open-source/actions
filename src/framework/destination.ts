import { Server } from "../server";

import  { DataActionRequest } from './data_action_request';
import  { DataActionResponse } from './data_action_response';
import  { DataActionForm } from './data_action_form';

export class Destination {

  public name : string;
  public label : string;

  public action : (request : DataActionRequest) => Promise<DataActionResponse>;
  public form : (request : DataActionRequest) => Promise<DataActionForm>;

  public asJson() : any {
    return {
      name: this.name,
      label: this.label,
      url: this.action ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/action`) : null,
      form_url: this.form ? Server.absUrl(`/destinations/${encodeURIComponent(this.name)}/form`) : null,
    };
  }

}
