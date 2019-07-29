import * as Hub from "../../hub";
import "json-to-markdown";
import { find, filter, uniqBy } from "lodash";


const MAX_PAYLOAD = 4096
const j2md = require('json-to-markdown');

export class ChimeMarkdownTable extends Hub.Action {

  name = "chime-table"
  label = "Chime Table"
  iconName = "amazon/chime.png"
  description = "Write a markdown table to chime."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "webhook",
    label: "Webhook",
    required: true,
    description: `This is a default webhook to be written to; it can be overridden. See - https://docs.aws.amazon.com/chime/latest/ug/webhooks.html`,
    sensitive: false,
  }]

  async execute(request: Hub.ActionRequest) {

    let hiddenFields: string[] = []
    if (request.scheduledPlan &&
        request.scheduledPlan.query &&
        request.scheduledPlan.query.vis_config &&
        request.scheduledPlan.query.vis_config.hidden_fields) {
      hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
    }

    let hostName: string = ''
    if (request.scheduledPlan &&
        request.scheduledPlan.url) {
      hostName = request.scheduledPlan.url.split('/').slice(0, 3).join('/');
    } 

    const details: any = (request.attachment && request.attachment.dataJSON) ? request.attachment.dataJSON : null;
    const webhook = (request.formParams.webhook_override) ? request.formParams.webhook_override : request.params.webhook;
    const fields = (details && details.fields) ? details.fields : {} 
    const fieldTypes: string[] = ['dimensions','measures','table_calculations'];
    const dataLen: number = details.data.length
    
    var fieldsOut: string[] = [];

    fieldTypes.forEach(function (item: string) {
      if(fields[item] && fields[item].length>0) {
        for (var i=0; i<fields[item].length; i++) {
          var tmp: any = fields[item][i]
            tmp['_hidden'] = ( hiddenFields.indexOf(tmp.name) > -1 )
            tmp['_type'] = item
            fieldsOut.push(tmp)           
        }
      }
    });

    var mdObject: any = this.convertToMD(details.data, fieldsOut, hostName, request.formParams.include_links);
 
    // send title from action hub parameter
    let response
    try {
      if ( request.formParams.send_title == 'yes' ) {
        var q: any = await this.webhook_post(webhook, request.scheduledPlan.title )
      }
      
      // send table
      var r: any = await this.webhook_post(webhook, mdObject.md);
  
      if (mdObject.rows < dataLen) {
        var s: any = await this.webhook_post(webhook, 'Showing '+mdObject.rows.toLocaleString('en-US')+'/'+dataLen.toLocaleString('en-US')+' rows. [See all rows]('+request.scheduledPlan.url+')');
      }
    } catch (e) {
      response = {success: false, message: e.messqage}
    }
    if (r && r.MessageId && r.RoomId) {
      response = {success: true, message: '200'}
    } else {
      response = {success: false, message: 'failed to send webhook to group'}
    }
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()

    try {
      form.fields = [{
        description: "Override the default webhook for your Amazon Chime group chat",
        label: "Override Webhook",
        name: "webhook_override",
        required: false,
        type: "string",
      }, {
        label: "Comment",
        options: [{ label: "Yes", name: "yes"}, { label: "No", name: "no"}],
        type: "select",
        name: "send_title",
      }, {
        label: "Include Links",
        name: "include_links",
        description: "Include Drill Links in Markdown Table",
        options: [{ label: "All", name: "all"}, { label: "First", name: "first"}, { label: "None", name: "none"}],
        type: "select",
      }]
    } catch (e) {
      form.error = this.prettyError(e)
    }

    return form
  }

  private prettyError(e: any) {
    if (e.message === "An API error occurred: invalid_auth") {
      return "Something went wrong."
    } else {
      return e
    }
  }

  private linkURL(hostname: string, link: string) {
    return hostname + link.replace(' ','+');
  }

  private convertToMD(data: any, fields_out: any, hostName: string, includeLinks: string) {
    var columns: string[] = []
    var out: string[] = []

    data.forEach((row: any, index: number) => {
      var temp: any = {};
      Object.keys(row).map((key: string) => {
        // lookup the key in the fields collection
        var findKey = find(fields_out, { 'name': key});
        if (!findKey._hidden) {

         var label: string = (findKey) ? (findKey.label_short || findKey.label) : findKey.name; // find the label (short) of the field
         var value: string = row[key].rendered || row[key].value; // find the rendered value
   
         // if links are on, and the row has links, start the link generation
         if ( includeLinks != 'none' && row[key] && row[key].links) {
          
           var tmpLinks: any = filter(row[key].links, function(o: any) { return o.type != 'action'; }) // remove actions drills

           tmpLinks.forEach((tempLink: any, j: number)=>{
            if (j==0) {
              value = '['+value+'](' + this.linkURL(hostName,tempLink.url) + ')';
            } else if (includeLinks == 'all') {
              value = value + ' [['+tempLink.label+']](' + this.linkURL(hostName,tempLink.url) + ')'
            }
           })
         }
         columns.push(label);
         temp[label] = value;       
        }
      });
      var tempCheck: any = out.concat([temp]);
      var tempCheckBytes: number = ('/md '+ j2md(tempCheck, uniqBy(columns))).length
  
      if (tempCheckBytes<=MAX_PAYLOAD) {
        out.push(temp);
      } else {
        return {md: j2md(out, uniqBy(columns)), rows: index}
      }
    })
    return {md: j2md(out, uniqBy(columns)), rows: data.length}
  }

  private webhook_post(webhook: string, data: any){
    return new Promise((resolve, reject) => {
      var req = require('request');

      var options = {
        url: webhook, 
        body: JSON.stringify({'Content': '/md '+data}),
        headers: {}
      }

      req.post(options, function optionalCallback(err: any, httpResponse: any, body: any) {
        // console.log(httpResponse);
        if (err) {
          console.log(err)
          reject(err);
        }
        resolve(body)
      })
    });
  }  

  private success(body: any) {
    return this.buildResponse(200, body);
  }
  
  private failure(body: any) {
    return this.buildResponse(500, body);
  }
  
  private buildResponse(statusCode: number, body: any) {
    return {
      statusCode: statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true
      },
      body: JSON.stringify(body)
    };
  }

}

Hub.addAction(new ChimeMarkdownTable())
