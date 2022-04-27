"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMailTransporter = void 0;
const nodemailer = require("nodemailer");
function getMailTransporter(request) {
    const { smtpHost, smtpPort, smtpFrom, smtpUser, smtpPass, user_email, } = request.params;
    if (!smtpHost) {
        throw new Error("Missing request.params.smtpHost");
    }
    if (!smtpPort) {
        throw new Error("Missing request.params.smtpPort");
    }
    if (!smtpFrom) {
        throw new Error("Missing request.params.smtpFrom");
    }
    if (!smtpUser) {
        throw new Error("Missing request.params.smtpUser");
    }
    if (!smtpPass) {
        throw new Error("Missing request.params.smtpPass");
    }
    if (!user_email) {
        throw new Error("Missing request.params.user_email");
    }
    const transport = {
        host: smtpHost,
        port: smtpPort,
        secure: true,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    };
    const defaults = {
        from: smtpFrom,
        to: user_email,
    };
    const transporter = nodemailer.createTransport(transport, defaults);
    return transporter;
}
exports.getMailTransporter = getMailTransporter;
