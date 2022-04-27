import * as nodemailer from "nodemailer";
import * as Hub from "../../hub";
export declare function getMailTransporter(request: Hub.ActionRequest): nodemailer.Transporter;
