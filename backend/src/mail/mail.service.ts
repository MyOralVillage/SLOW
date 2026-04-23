import { Injectable, Logger } from "@nestjs/common";

/**
 * Outbound email (configure one):
 *
 * 1) Resend (simplest for production): set RESEND_API_KEY and optional RESEND_FROM
 *    Free tier: use from "SLOW <onboarding@resend.dev>" until you add a domain.
 *
 * 2) SMTP: set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM
 *
 * If neither is set, the link is only written to server logs (Render → Logs) — no email is sent.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  private async sendWithResend(
    to: string,
    subject: string,
    text: string,
  ): Promise<boolean> {
    const key = String(process.env.RESEND_API_KEY || "").trim();
    if (!key) return false;

    const from = String(process.env.RESEND_FROM || "SLOW <onboarding@resend.dev>");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      const detail = body || res.statusText || "Unknown Resend error";
      this.log.error(`Resend API error ${res.status} ${res.statusText}: ${detail}`);
      throw new Error(`Resend failed: ${res.status} ${res.statusText} - ${detail}`);
    }
    this.log.log(`Resend: email sent to ${to}`);
    return true;
  }

  private async sendWithSmtp(
    to: string,
    subject: string,
    text: string,
  ): Promise<boolean> {
    if (!process.env.SMTP_HOST) return false;

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
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
        to,
        subject,
        text,
      });
    } catch (err) {
      this.log.error(`SMTP send failed to ${to} via ${process.env.SMTP_HOST || "unknown host"}`, err);
      throw err;
    }
    this.log.log(`SMTP: email sent to ${to}`);
    return true;
  }

  private logOnly(to: string, subject: string, text: string, kind: string) {
    this.log.warn(
      [
        `No RESEND_API_KEY or SMTP configured — no real email is sent for: ${kind}`,
        `To: ${to}`,
        `---`,
        text,
        `---`,
        `Set RESEND_API_KEY (see resend.com) or SMTP_* on Render to deliver mail.`,
      ].join("\n"),
    );
  }

  private async sendMail(to: string, subject: string, text: string, kind: string) {
    try {
      if (await this.sendWithResend(to, subject, text)) return;
      if (await this.sendWithSmtp(to, subject, text)) return;
      this.logOnly(to, subject, text, kind);
    } catch (err) {
      this.log.error(`sendMail failed (${kind} to ${to})`, err);
      throw err;
    }
  }

  async sendVerificationEmail(to: string, verifyUrl: string) {
    const subject = "Verify your SLOW account";
    const text = `Open this link to verify your email (valid 48 hours):\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this.`;
    await this.sendMail(to, subject, text, "verification");
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    const subject = "Reset your SLOW password";
    const text = `You asked to reset your password. Open this link (valid 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email. Your password will not change.`;
    await this.sendMail(to, subject, text, "password reset");
  }
}
