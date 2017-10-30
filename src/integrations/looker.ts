import * as request from "request"
import * as _ from "underscore"

export interface ILookerRequestConfig {
  method: string
  path: string
  headers?: request.Headers
  body?: any
}

export interface ILookerRequestOptions {
  encoding?: string | null
}

export class LookerAPIClient {

  private token?: string
  private tokenError?: string

  constructor(private options: {
    baseUrl: string,
    clientId: string,
    clientSecret: string,
  }) {
    this.options = options
    this.fetchAccessToken()
  }

  request(
    requestConfig: ILookerRequestConfig & ILookerRequestOptions,
    successCallback?: any,
    errorCallback?: any,
  ) {

    if (!this.reachable()) {
      errorCallback({error: `Looker ${this.options.baseUrl} not reachable.\n${this.tokenError || ""}`})
      return
    }

    if (!errorCallback) {
      errorCallback = () => { return }
    }
    if (!successCallback) {
      successCallback = () => { return }
    }

    const newConfig: request.CoreOptions & request.UrlOptions = {
      body: requestConfig.body,
      headers: {
        "Authorization": `token ${this.token}`,
        "User-Agent": `looker-integrations`, // /${config.version}
      },
      method: requestConfig.method,
      url: `${this.options.baseUrl}/${requestConfig.path}`,
    }

    if (typeof requestConfig.encoding !== "undefined") {
      newConfig.encoding = requestConfig.encoding
    }

    newConfig.headers = _.extend(newConfig.headers, requestConfig.headers || {})

    request(newConfig, (error, response, body: string | Buffer) => {
      if (error) {
        errorCallback(error)
      } else if (response.statusCode === 200) {
        if (response.headers["content-type"].indexOf("application/json") !== -1) {
          successCallback(JSON.parse(body as string))
        } else {
          successCallback(body)
        }
      } else {
        try {
          if (Buffer.isBuffer(body) && (body.length === 0)) {
            errorCallback({error: "Received empty response from Looker."})
          } else {
            errorCallback(JSON.parse(body as string))
          }
        } catch (error1) {
          errorCallback({error: "Couldn't parse Looker response. The server may be offline."})
        }
      }
    })

  }

  async requestAsync(requestConfig: ILookerRequestConfig) {
    return new Promise<any>((resolve, reject) => {
      this.request(requestConfig, resolve, reject)
    })
  }

  get(path: string, successCallback?: any, errorCallback?: any, options?: ILookerRequestOptions) {
    this.request(_.extend({method: "GET", path}, options || {}), successCallback, errorCallback)
  }

  async getAsync(path: string, options?: ILookerRequestOptions): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.get(path, resolve, reject, options)
    })
  }

  async getBinaryAsync(path: string): Promise<Buffer> {
    return this.getAsync(path, {encoding: null})
  }

  post(path: string, body: any, successCallback?: any, errorCallback?: any) {
    this.request(
      {
        body: JSON.stringify(body),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
        path,
      },
      successCallback,
      errorCallback,
    )
  }

  async postAsync(path: string, body: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.post(path, body, resolve, reject)
    })
  }

  fetchAccessToken() {

    const options = {
      form: {
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
      },
      method: "POST",
      url: `${this.options.baseUrl}/login`,
    }

    request(options, (error, response, body) => {
      this.tokenError = undefined
      if (error) {
        this.tokenError = error
        this.token = undefined
      } else if (response.statusCode === 200) {
        const json = JSON.parse(body)
        this.token = json.access_token
      } else {
        this.token = undefined
      }

    })
  }

  private reachable() {
    return (this.token !== undefined)
  }

}
