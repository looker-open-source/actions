import  { Promise } from 'es6-promise';

import  { DataActionRequest } from './data_action_request';
import  { DataActionResponse } from './data_action_response';

export class Destination {

  public label : string;
  public id : string;

  public action : (request : DataActionRequest) => Promise<DataActionResponse>;

}
