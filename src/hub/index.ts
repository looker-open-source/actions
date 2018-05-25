export * from "./action_form"
export * from "./action_request"
export * from "./action_response"
export * from "./action"
export * from "./sources"
export * from "./utils"

import { LookmlModelExploreField as Field } from "../api_types/lookml_model_explore_field"
import { LookmlModelExploreFieldset as Fieldset } from "../api_types/lookml_model_explore_fieldset"
import * as JsonDetail from "./json_detail"

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
  return all
}

export { JsonDetail, Field, Fieldset, allFields }
