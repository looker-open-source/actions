export * from "./action_form"
export * from "./action_request"
export * from "./action_state"
export * from "./action_response"
export * from "./action"
export * from "./oauth_action"
export * from "./delegate_oauth_action"
export * from "./sources"
export * from "./utils"

import { LookmlModelExploreField as FieldBase } from "../api_types/lookml_model_explore_field"
import { LookmlModelExploreFieldset as ExploreFieldset } from "../api_types/lookml_model_explore_fieldset"
import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto"

import * as JsonDetail from "./json_detail"

// LookmlModelExploreField is not the same as what Looker will actually send
// The fields are right, but some are omitted in json_detail.
interface Field extends Partial<FieldBase> {
  name: string
}

interface Fieldset extends ExploreFieldset {
  table_calculations: Field[] | null
}

function allFields(fields: Fieldset) {
  let all: Field[] = []
  if (fields.dimensions) {
    all = all.concat(fields.dimensions)
  }
  if (fields.measures) {
    all = all.concat(fields.measures)
  }
  if (fields.filters) {
    all = all.concat(fields.filters)
  }
  if (fields.parameters) {
    all = all.concat(fields.parameters)
  }
  if (fields.table_calculations) {
    all = all.concat(fields.table_calculations)
  }
  return all
}

export { ActionCrypto, JsonDetail, Field, Fieldset, allFields }
