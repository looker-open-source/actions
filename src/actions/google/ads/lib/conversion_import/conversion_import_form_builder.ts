import * as Hub from "../../../../../hub"
import { GoogleAdsConversionImportActionRequest } from "./conversion_import_request"

interface SelectFormOption {name: string, label: string}

interface AdsCustomer {
  resourceName: string
  manager: boolean
  descriptiveName: string
  id: string
}

export class GoogleAdsConversionImportActionFormBuilder {

  readonly apiClient = this.adsRequest.apiClient!
  readonly loginCid = this.adsRequest.loginCid
  readonly targetCid = this.adsRequest.targetCid

  loginCustomer?: AdsCustomer
  targetCustomer?: AdsCustomer

  constructor(readonly adsRequest: GoogleAdsConversionImportActionRequest) {}

  async makeForm() {
    const form = new Hub.ActionForm()

    // 0) Fetch objects for fields that have been filled in already
    await Promise.all([
      this.maybeSetLoginCustomer(),
      this.maybeSetTargetCustomer(),
    ])

    // 1a) User must first pick a login account from the dropdown, which will be the only field to show at first
    form.fields.push(await this.loginCidField())
    if (!this.loginCustomer) { return form }

    // 1b) If the chosen login account is a Manager, give the option to pick one of its client accounts as the target.
    if (this.loginCustomer.manager) {
      form.fields.push(await this.targetCidField())
      if (!this.targetCustomer) { return form }
      // If not a manager account, set the targetCustomer to be the same as the loginCustomer
    } else {
      this.targetCustomer = this.loginCustomer
    }
    return form
  }

  async loginCidField() {
    let selectOptions: SelectFormOption[]
    let description: string

    if (this.loginCustomer) {
      selectOptions = [
        this.selectOptionForCustomer(this.loginCustomer),
      ]
      description = "To reset this selection, please close and re-open the form."
    } else {
      selectOptions = await this.getLoginCidOptions()
      description = "This is like picking an account to work from using the menu in the Google Ads UI."
        + " If you use a manager account to manage clients, choose the relevant manager account here."
        + " If you login directly to an Ads account then choose it here."
    }

    return {
      name: "loginCid",
      label: "Step 1) Choose login account",
      description,
      type: "select" as "select",
      options: selectOptions,
      default: this.loginCid as string,
      interactive: true,
      required: true,
    }
  }

  async targetCidField() {
    let selectOptions: SelectFormOption[]
    let description: string

    if (this.targetCustomer) {
      selectOptions = [
        this.selectOptionForCustomer(this.targetCustomer),
        {name: "", label: "Reset..."},
      ]
      description = "Select \"Reset\" to go back."
    } else {
      selectOptions = await this.getTargetCidOptions()
      description = "This is the account where you want to send data, i.e. where the audience lists are defined."
    }

    return {
      name: "targetCid",
      label: "Step 1b) Choose target account",
      description,
      type: "select" as "select",
      options: selectOptions,
      default: this.targetCid as string,
      interactive: true,
      required: true,
    }
  }

  private async maybeSetLoginCustomer() {
    if (!this.loginCid) {
      return
    }
    this.loginCustomer = await this.getCustomer(this.loginCid)
  }

  private async maybeSetTargetCustomer() {
    if (!this.targetCid) {
      return
    }
    this.targetCustomer = await this.getCustomer(this.targetCid)
  }

  private async getLoginCidOptions() {
    const listCustomersResp = await this.apiClient.listAccessibleCustomers()
    const customerResourceNames = listCustomersResp.resourceNames
    const customers = await Promise.all(customerResourceNames.map(async (rn: string) => {
      const clientCid = rn.replace("customers/", "")
      return this.getCustomer(clientCid).catch(() =>  undefined) // ignore any auth errors from draft accounts
    }))
    const filteredCustomers = customers.filter(Boolean) as AdsCustomer[]
    const sortedCustomers = filteredCustomers.sort(this.sortCustomersCompareFn)
    const selectOptions = sortedCustomers.map(this.selectOptionForCustomer)
    return selectOptions
  }

  private async getCustomer(cId: string) {
    return await this.apiClient.searchClientCustomers(cId)
      .then((data: any) => {
        const cust  = data[0].results.filter((c: any) => c.customerClient.id === cId)[0].customerClient
        if (!cust.descriptiveName) { cust.descriptiveName = "Untitled" }
        return cust as AdsCustomer
      })
  }

  private async getTargetCidOptions() {
    if (!this.loginCustomer) {
      throw new Error("Could not reference the login customer record.")
    }
    const searchResp = await this.apiClient.searchClientCustomers(this.loginCustomer.id)
    const searchResults = searchResp.length ? searchResp[0].results : []
    const clients = searchResults.map((result: any) => {
      const client = result.customerClient
      if (!client.descriptiveName) {
        client.descriptiveName = "Untitled"
      }
      return client
    })
    const sortedClients = clients.sort(this.sortCustomersCompareFn)
    const selectOptions = sortedClients.map(this.selectOptionForCustomer)

    return selectOptions
  }

  private selectOptionForCustomer(customer: AdsCustomer) {
    const name = customer.id
    const title = customer.descriptiveName ? customer.descriptiveName : "Untitled"
    const prefix = customer.manager ? "[Manager] " : ""
    const suffix = `(${customer.id})`
    const label = `${prefix}${title} ${suffix}`

    return {name, label} as SelectFormOption
  }

  private sortCustomersCompareFn(a: AdsCustomer, b: AdsCustomer) {
    if (a.manager && !b.manager) {
      return -1
    }
    if (!a.manager && b.manager) {
      return 1
    }
    if (a.descriptiveName < b.descriptiveName) {
      return -1
    }
    return 0
  }
}
