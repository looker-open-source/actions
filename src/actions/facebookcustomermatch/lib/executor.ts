import * as Hub from "../../../hub";

import * as winston from "winston"
import * as crypto from "crypto"
import * as oboe from "oboe"
import { Readable } from "stream"

import { UserUploadSession, UserUploadPayload, UserFields, validFacebookHashCombinations} from "./api"
import FacebookCustomerMatchApi from "./api"

const BATCH_SIZE = 10000; // Maximum size allowable by Facebook endpoint

interface FieldMapping {
  lookMLFieldName: string, // TODO remove this property if it turns out tags can't be obtained with JsonLabel streams
  fallbackRegex: any,
  userField: string, // The property that ties looker columnLabels to facebook API fields
  normalizationFunction: (s: string) => string // each one is a special snowflake...
}

export default class FacebookCustomerMatchExecutor {
  private actionRequest: Hub.ActionRequest
  private batchPromises: Promise<void>[] = []
  private batchQueue: any[] = []
  private currentRequest: Promise<any> | undefined
  private isSchemaDetermined = false
  private matchedHashCombinations: [(f: UserFields) => string, string][] = []
  private rowQueue: any[] = []
  private schema: {[s: string]: FieldMapping} = {}
  private batchIncrementer: number = 0
  private sessionId: number
  private facebookAPI: FacebookCustomerMatchApi
  
  // form params
  private shouldHash: boolean = true
  private operationType: string
  private adAccountId: string
  private customAudienceId: string | undefined = ""
  private customAudienceName: string | undefined = ""
  private customAudienceDescription: string | undefined = ""

  constructor(actionRequest: Hub.ActionRequest, accessToken: string) {
    this.actionRequest = actionRequest
    this.sessionId =  Date.now() // a unique id used to associate multiple requests with one custom audience API action
    this.facebookAPI = new FacebookCustomerMatchApi(accessToken)
    this.shouldHash = actionRequest.formParams.should_hash === "do_no_hashing" ? false : true
    const operationType = actionRequest.formParams.choose_create_update_replace
    if(!operationType) {
      throw new Error("Cannot execute action without choosing an operation type.")
    }
    this.operationType = operationType

    if(!actionRequest.formParams.choose_business || !actionRequest.formParams.choose_ad_account) {
      throw new Error("Cannot execute action without business id or ad account id.")
    }
    if(!actionRequest.formParams.choose_custom_audience && (
      operationType === "update_audience" || operationType === "replace_audience"
    )) {
      throw new Error("Cannot update or replace without a custom audience id.")
    }

    this.adAccountId = actionRequest.formParams.choose_ad_account
    this.customAudienceId = actionRequest.formParams.choose_custom_audience
    this.customAudienceName = actionRequest.formParams.create_audience_name
    this.customAudienceDescription = actionRequest.formParams.create_audience_description
  }

  private fieldMapping : FieldMapping[] = [
    {
      lookMLFieldName: "Email",
      fallbackRegex: /email/i,
      userField: "email",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "Phone",
      fallbackRegex: /phone/i,
      userField: "phone",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "Gender",
      fallbackRegex: /gender/i,
      userField: "gender",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "BirthYear",
      fallbackRegex: /year/i,
      userField: "birthYear",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "BirthMonth",
      fallbackRegex: /month/i,
      userField: "birthMonth",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "BirthDay",
      fallbackRegex: /day/i,
      userField: "birthDay",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "LastName",
      fallbackRegex: /last/i,
      userField: "lastName",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "FirstName",
      fallbackRegex: /first/i,
      userField: "firstName",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "FirstInitial",
      fallbackRegex: /initial/i,
      userField: "firstInitial",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "City",
      fallbackRegex: /city/i,
      userField: "city",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "State",
      fallbackRegex: /state/i,
      userField: "state",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "Zip",
      fallbackRegex: /postal|zip/i,
      userField: "zip",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "Country",
      fallbackRegex: /country/i,
      userField: "country",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "MadID",
      fallbackRegex: /madid/i,
      userField: "madid",
      normalizationFunction: this.normalize
    },
    {
      lookMLFieldName: "ExternalID",
      fallbackRegex: /external/i,
      userField: "externalId",
      normalizationFunction: this.normalize
    },
  ]

  private get batchIsReady() {
    return this.rowQueue.length >= BATCH_SIZE
  }

  private get numBatches() {
    return this.batchPromises.length
  }

  async run() {
    if (this.operationType === "create_audience") {
      if(!this.customAudienceName || !this.customAudienceDescription) {
        throw new Error("Cannot create an audience if name or description are missing.")
      }
      const customAudienceId = await this.facebookAPI.createCustomAudience(this.adAccountId, this.customAudienceName, this.customAudienceDescription)
      if(!customAudienceId || typeof customAudienceId !== "string") {
        throw new Error("Failed to create audience. Cannot execute action.")
      }
      this.customAudienceId = customAudienceId
    }
    try {
      // The ActionRequest.prototype.stream() method is going to await the callback we pass
      // and either resolve the result we return here, or reject with an error from anywhere
      await this.actionRequest.stream(async (downloadStream: Readable) => {
        return this.startAsyncParser(downloadStream)
      })
    } catch (errorReport) {
      // TODO: the oboe fail() handler sends an errorReport object, but that might not be the only thing we catch
      winston.error("Streaming parse failure:" +  errorReport.toString())
    }
    await Promise.all(this.batchPromises)
    winston.debug("info",
      `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`,
    )
  }

  private async startAsyncParser(downloadStream: Readable) {
    return new Promise<void>((resolve, reject) => {
      oboe(downloadStream)
        .node("!.*", (row: any) => {          
          if (!this.isSchemaDetermined) {
            this.determineSchema(row)
          }
          this.handleRow(row)
          this.scheduleBatch()
          return oboe.drop
        })
        .done(() => {
          this.scheduleBatch(true)
          resolve()
        })
        .fail(reject)
    })
  }

  private determineSchema(row: any) {
    for (const columnLabel of Object.keys(row)) {
      for (const mapping of this.fieldMapping) {
        const {fallbackRegex} = mapping

        if(columnLabel.match(fallbackRegex)) {
          this.schema[columnLabel] = mapping
        }
      }
    }
    const formattedRow = this.getFormattedRow(row, this.schema)
    this.matchedHashCombinations = this.getMatchingHashCombinations(formattedRow, validFacebookHashCombinations)
    this.isSchemaDetermined = true
  }


  /*
IN
    {
      "Users First Name": "Timmy",
      "Users Email": "tt@coolguy.net",
      ...
    },
    {
      "Users First Name": {..., userField: "firstName"},
      ...
    }

OUT
    {
      email: "tt@coolguy.net",
      phone: null,
      gender: null,
      birthYear: null,
      birthMonth: null,
      birthDayOfMonth: null,
      birthday: null,
      lastName: null,
      firstName: "Timmy",
      firstInitial: null,
      city: null,
      state: null,
      zip: null,
      country: null,
      madid: null,
      externalId: null,
    }
*/
  // Get a uniform object that's easy to feed to transform functions
  private getFormattedRow(row: any, schema: {[s: string]: FieldMapping}): UserFields {
    let formattedRow: UserFields = this.getEmptyFormattedRow()
    Object.entries(schema).forEach(([columnLabel, mapping]) => {
      formattedRow[mapping.userField] = row[columnLabel]
    });
    return formattedRow
  }

  private getEmptyFormattedRow(initialValue: string | null | undefined = null) : UserFields {
    return {
      email: initialValue,
      phone: initialValue,
      gender: initialValue,
      birthYear: initialValue,
      birthMonth: initialValue,
      birthDayOfMonth: initialValue,
      birthday: initialValue,
      lastName: initialValue,
      firstName: initialValue,
      firstInitial: initialValue,
      city: initialValue,
      state: initialValue,
      zip: initialValue,
      country: initialValue,
      madid: initialValue,
      externalId: initialValue,
    }
  }

  // Pass in the ones you have and this will return only the hash combinations you have enough data for
  private getMatchingHashCombinations(fieldsWithData: UserFields, hashCombinations: [(f: UserFields) => string, string][]): any[] {
    const dummyFormattedRow = this.getEmptyFormattedRow("EMPTY")
    Object.entries(fieldsWithData).forEach(([field, data]) => {
      if (data !== null) {
        dummyFormattedRow[field] = "FILLED"
      }
    })
    // this was a very fancy way of creating a complete formatted row with only the fields you have using non-null values
  
    // just return the ones that didn't have the EMPTY string in them
    return hashCombinations.filter((hc) => {
      const transformFunction = hc[0]
      const returnedString:string = transformFunction(dummyFormattedRow)
      return returnedString.indexOf("EMPTY") < 0
    })
  }

  private handleRow(row: any) {
    const output = this.transformRow(row)
    this.rowQueue.push(output)
  }

  /* 
    Transforms a row of Looker data into a row of data formatted for the Facebook marketing API.
    Missing data is filled in with empty strings.
  */
  private transformRow(row: any) {
    row = this.normalizeRow(row)    
    const formattedRow = this.getFormattedRow(row, this.schema) // get a uniform object
    // turn our uniform object into X strings like doe_john_30008_1974. One per transform we have enough data for
    let transformedRow = this.matchedHashCombinations.map(([transformFunction, _facebookAPIFieldName]) => {
      if (this.shouldHash) {
        return this.hash(transformFunction(formattedRow)) || ""
      }
      return transformFunction(formattedRow) || ""
    })
    return transformedRow.length === 1 ? transformedRow[0] : transformedRow; // unwrap an array of one entry, per facebook docs
  }

  private normalizeRow(row: any) {
    const normalizedRow = {...row}
    Object.entries(this.schema).forEach(([columnLabel, mapping]) => {
      normalizedRow[columnLabel] = mapping.normalizationFunction(row[columnLabel])
    })
    return normalizedRow
  }

  private createUploadSessionObject(batchSequence: number, finalBatch: boolean, totalRows?:number): UserUploadSession {
    return {
      "session_id": this.sessionId, 
      "batch_seq":batchSequence, 
      "last_batch_flag": finalBatch, 
      "estimated_num_total": totalRows 
    }
  }

  private hash(rawValue: string) {
    return crypto.createHash("sha256").update(rawValue).digest("hex")
  }
  private normalize(rawValue: string) {
    return rawValue.trim().toLowerCase()
  }

  private scheduleBatch(finalBatch = false) {
    if ( !this.batchIsReady && !finalBatch ) {
      return
    }
    this.batchIncrementer += 1
    const batch = {
      data: this.rowQueue.splice(0, BATCH_SIZE - 1),
      batchSequence: this.batchIncrementer,
      finalBatch
    }
    this.batchQueue.push(batch)
    this.batchPromises.push(this.sendBatch())
  }

  private async sendBatch(): Promise<void> {
    if (this.currentRequest !== undefined || this.batchQueue.length === 0) {
      return;
    }
    const {batchSequence, data : currentBatch , finalBatch} = this.batchQueue.shift();
    const sessionParameter = this.createUploadSessionObject(batchSequence, finalBatch)
    const payloadParameter: UserUploadPayload = {
      schema: this.matchedHashCombinations.map(([_transformFunction, facebookAPIFieldName]) => facebookAPIFieldName),
      data: currentBatch,
    };
   
    let apiMethodToCall = this.facebookAPI.appendUsersToCustomAudience.bind(this.facebookAPI)
    if(this.operationType === "replace_audience") {
      apiMethodToCall = this.facebookAPI.replaceUsersInCustomAudience.bind(this.facebookAPI)
    }
    if(!this.customAudienceId) {
      throw new Error("Could not upload users because customAudienceId was missing.")
    }
    this.currentRequest = apiMethodToCall(this.customAudienceId, sessionParameter, payloadParameter)
    await this.currentRequest;
    this.currentRequest = undefined;
    return this.sendBatch();
  }
}