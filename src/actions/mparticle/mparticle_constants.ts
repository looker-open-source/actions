export const MP_API_URL = "https://inbound.mparticle.com/s2s/v2/bulkevents"
export const EVENT_TYPE = "custom_event"
export const DEFAULT_EVENT_NAME = "looker_custom_event"
export const DEFAULT_CUSTOM_EVENT_TYPE = "other"
export const DEV_ENVIRONMENT = "development"
export const MAX_EVENTS_PER_BATCH = 100
export const PROD_ENVIRONMENT = "production"
export const USER = "user_data"
export const EVENT = "event_data"
export const VALID_DEVICE_INFO_FIELDS = [
  "brand",
  "product",
  "device",
  "android_uuid",
  "device_manufacturer",
  "platform",
  "os_version",
  "device_model",
  "screen_height",
  "screen_width",
  "screen_dpi",
  "device_country",
  "locale_language",
  "locale_country",
  "network_country",
  "network_carrier",
  "network_code",
  "network_mobile_country_code",
  "timezone_offset",
  "build_identifier",
  "http_header_user_agent",
  "ios_advertising_id",
  "push_token",
  "cpu_architecture",
  "is_tablet",
  "push_notification_sound_enabled",
  "push_notification_vibrate_enabled",
  "radio_access_technology",
  "supports_telephony",
  "has_nfc",
  "bluetooth_enabled",
  "bluetooth_version",
  "ios_idfv",
  "android_advertising_id",
  "limit_ad_tracking",
  "is_dst",
]
