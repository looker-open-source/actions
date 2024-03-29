export interface DataWebhookPayloadAttachment {
    /** MIME type of the attachment. Ends with ";base64" if the attachment is Base64 encoded. */
    mimetype: string | null;
    /** File extension of the attachment. */
    extension: string | null;
    /** Attachment data. For JSON formats, this JSON is inline. */
    data: string | null;
}
export interface RequestDataWebhookPayloadAttachment {
}
