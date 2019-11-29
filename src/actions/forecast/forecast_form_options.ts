// TODO: add links to documentation where these options are enumerated
export const domainOptions = [
  "RETAIL",
   "CUSTOM",
   "INVENTORY_PLANNING",
   "EC2_CAPACITY",
   "WORK_FORCE",
   "WEB_TRAFFIC",
   "METRICS"]

export const dataFrequencyOptions = {
  "Y": "Yearly",
  "M": "Monthly",
  "W": "Weekly",
  "D": "Daily",
  "H": "Hourly",
  "30min": "Every 30 minutes",
  "15min": "Every 15 minutes",
  "10min": "Every 10 minutes",
  "5min": "Every 5 minutes",
  "1min": "Every minute",
}

export const holidayCalendarOptions = {
  AU: "Australia",
  DE: "Germany",
  JP: "Japan",
  US: "United States",
  UK: "United Kingdom",
}

export const datasetTypeOptions = {
  TARGET_TIME_SERIES: "Target time series",
  RELATED_TIME_SERIES: "Related time series",
  ITEM_METADATA: "Item metadata",
}

export const datasetSchemaDefault = {
  Attributes: [
    {
      AttributeName: "timestamp",
      AttributeType: "timestamp",
    },
    {
      AttributeName: "item_id",
      AttributeType: "string",
    },
    {
      AttributeName: "target_value",
      AttributeType: "float",
    },
  ],
}
