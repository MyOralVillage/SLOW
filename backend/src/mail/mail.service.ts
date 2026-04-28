import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

type MailProvider = "resend" | "smtp" | "log";

type MailTransport = {
  provider: MailProvider;
  realDelivery: boolean;
};

export type MailSendResult = {
  provider: MailProvider;
  delivered: boolean;
  previewUrl?: string;
};

/**
 * Outbound email:
 *
 * Production:
 * - EMAIL_PROVIDER=resend with RESEND_API_KEY
 * - EMAIL_PROVIDER=smtp with SMTP_HOST/SMTP_*
 *
 * Development preview:
 * - EMAIL_PROVIDER=log
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  private requestedProvider() {
    return String(process.env.EMAIL_PROVIDER || "auto").trim().toLowerCase();
  }

  private senderAddress(defaultValue: string) {
    return String(process.env.EMAIL_FROM || process.env.RESEND_FROM || process.env.SMTP_FROM || defaultValue).trim();
  }

  private resolveTransport(): MailTransport {
    const requested = this.requestedProvider();
    const hasResend = Boolean(String(process.env.RESEND_API_KEY || "").trim());
    const hasSmtp = Boolean(String(process.env.SMTP_HOST || "").trim());

    if (requested === "log") {
      return { provider: "log", realDelivery: false };
    }

    if (requested === "resend") {
      if (!hasResend) {
        throw new ServiceUnavailableException("Email service is not configured. Set RESEND_API_KEY.");
      }
      return { provider: "resend", realDelivery: true };
    }

    if (requested === "smtp") {
      if (!hasSmtp) {
        throw new ServiceUnavailableException("Email service is not configured. Set SMTP_HOST and related SMTP_* values.");
      }
      return { provider: "smtp", realDelivery: true };
    }

    if (hasResend) {
      return { provider: "resend", realDelivery: true };
    }
    if (hasSmtp) {
      return { provider: "smtp", realDelivery: true };
    }

    throw new ServiceUnavailableException(
      "Email service is not configured. Configure RESEND_API_KEY or SMTP_*, or set EMAIL_PROVIDER=log for local preview.",
    );
  }

  assertTransportAvailable() {
    return this.resolveTransport();
  }

  private async sendWithResend(to: string, subject: string, text: string): Promise<MailSendResult> {
    const key = String(process.env.RESEND_API_KEY || "").trim();
    if (!key) {
      throw new ServiceUnavailableException("Email service is not configured. Set RESEND_API_KEY.");
    }

    // Resend's default onboarding sender is the safest fallback for new projects.
    // A display name can be rejected depending on account/domain state, so default to the raw email.
    const from = this.senderAddress("onboarding@resend.dev");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });

    if (!res.ok) {
      const body = await res.text();
      const detail = body || res.statusText || "Unknown Resend error";
      this.log.error(`Resend API error ${res.status} ${res.statusText}: ${detail}`);
      throw new BadGatewayException(`Resend delivery failed (${res.status}): ${detail}`);
    }

    this.log.log(`Resend: email sent to ${to}`);
    return { provider: "resend", delivered: true };
  }

  private async sendWithSmtp(to: string, subject: string, text: string): Promise<MailSendResult> {
    if (!process.env.SMTP_HOST) {
      throw new ServiceUnavailableException("Email service is not configured. Set SMTP_HOST and related SMTP_* values.");
    }

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
        from: this.senderAddress(process.env.SMTP_USER || "no-reply@localhost"),
        to,
        subject,
        text,
      });
    } catch (err) {
      this.log.error(`SMTP send failed to ${to} via ${process.env.SMTP_HOST || "unknown host"}`, err);
      throw new BadGatewayException("SMTP delivery failed. Check SMTP_* settings.");
    }

    this.log.log(`SMTP: email sent to ${to}`);
    return { provider: "smtp", delivered: true };
  }

  private logOnly(to: string, subject: string, text: string, kind: string, previewUrl?: string): MailSendResult {
    this.log.warn(
      [
        `EMAIL_PROVIDER=log preview for: ${kind}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        previewUrl ? `Preview URL: ${previewUrl}` : "",
        `---`,
        text,
        `---`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return {
      provider: "log",
      delivered: false,
      previewUrl,
    };
  }

  private async sendMail(
    to: string,
    subject: string,
    text: string,
    kind: string,
    previewUrl?: string,
  ): Promise<MailSendResult> {
    const transport = this.resolveTransport();

    if (transport.provider === "log") {
      return this.logOnly(to, subject, text, kind, previewUrl);
    }
    if (transport.provider === "resend") {
      return await this.sendWithResend(to, subject, text);
    }
    return await this.sendWithSmtp(to, subject, text);
  }

  async sendVerificationEmail(to: string, verifyUrl: string) {
    const subject = "Verify your SLOW account";
    const text = `Open this link to verify your email (valid 48 hours):\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this.`;
    return await this.sendMail(to, subject, text, "verification", verifyUrl);
  }

  async sendPasswordResetEmail(to: string, resetUrl: string) {
    const subject = "Reset your SLOW password";
    const text = `You asked to reset your password. Open this link (valid 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email. Your password will not change.`;
    return await this.sendMail(to, subject, text, "password reset", resetUrl);
  }
}
