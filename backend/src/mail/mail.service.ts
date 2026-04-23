import { Injectable, Logger } from "@nestjs/common";

/**
 * Optional SMTP: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * If unset, only logs the verification link (MVP / dev).
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  async sendVerificationEmail(to: string, verifyUrl: string) {
    const subject = "Verify your SLOW account";
    const text = `Open this link to verify your email (valid 48 hours):\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this.`;

    if (process.env.SMTP_HOST) {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || "587"),
        secure: String(process.env.SMTP_SECURE || "") === "true",
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
        to,
        subject,
        text,
      });
      this.log.log(`Verification email sent to ${to}`);
      return;
    }

    this.log.warn(`SMTP not configured. Verification link for ${to}:\n${verifyUrl}\n\n${text}`);
  }
}
