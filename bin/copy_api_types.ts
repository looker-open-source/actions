import * as fs from "fs"
import * as path from "path"

// This is an inelegant way of importing api typings from an internal Looker repo.
const requiredTypings = [
  "data_webhook_payload",
  "data_webhook_payload_attachment",
  "data_webhook_payload_scheduled_plan",
  "query",
  "integration",
  "integration_param",
  "integration_required_field",
  "lookml_model_explore_field",
  "lookml_model_explore_fieldset",
  "lookml_model_explore_field_enumeration",
  "lookml_model_explore_field_measure_filters",
  "lookml_model_explore_field_map_layer",
  "lookml_model_explore_field_sql_case",
  "lookml_model_explore_field_time_interval",
]

requiredTypings.forEach((t) => {
  const src = path.join(__dirname, "..", "..", "helltool", "lib", "helltool", "assets", "core_api", "types", `${t}.ts`)
  const dest = path.join(__dirname, "..", "src", "api_types", `${t}.ts`)
  if (!fs.existsSync(path.dirname(dest))) {
    fs.mkdirSync(path.dirname(dest))
  }
  fs.createReadStream(src).pipe(fs.createWriteStream(dest))
})
