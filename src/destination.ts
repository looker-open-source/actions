import  { Promise } from 'es6-promise';

import { Server } from "./server";

import  { DataActionRequest } from './data_action_request';
import  { DataActionResponse } from './data_action_response';
import  { DataActionForm } from './data_action_form';

export class Destination {

  public label : string;
  public id : string;

  public action : (request : DataActionRequest) => Promise<DataActionResponse>;
  public form : (request : DataActionRequest) => Promise<DataActionForm>;

  public asJson() : any {
    return {
      id: this.id,
      label: this.label,
      url: this.action ? Server.absUrl(`/destinations/${encodeURIComponent(this.id)}/action`) : null,
      form: this.form ? Server.absUrl(`/destinations/${encodeURIComponent(this.id)}/form`) : null,
    };
  }

}
