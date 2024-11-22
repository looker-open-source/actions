"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_DEVICE_INFO_FIELDS = exports.EVENT = exports.USER = exports.PROD_ENVIRONMENT = exports.MAX_EVENTS_PER_BATCH = exports.DEV_ENVIRONMENT = exports.DEFAULT_CUSTOM_EVENT_TYPE = exports.DEFAULT_EVENT_NAME = exports.EVENT_TYPE = exports.MP_API_URL = void 0;
exports.MP_API_URL = "https://inbound.mparticle.com/s2s/v2/bulkevents";
exports.EVENT_TYPE = "custom_event";
exports.DEFAULT_EVENT_NAME = "looker_custom_event";
exports.DEFAULT_CUSTOM_EVENT_TYPE = "other";
exports.DEV_ENVIRONMENT = "development";
exports.MAX_EVENTS_PER_BATCH = 100;
exports.PROD_ENVIRONMENT = "production";
exports.USER = "user_data";
exports.EVENT = "event_data";
exports.VALID_DEVICE_INFO_FIELDS = [
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
];
