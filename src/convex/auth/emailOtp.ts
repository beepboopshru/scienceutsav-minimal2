import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    try {
      const { data, error } = await resend.emails.send({
        from: "ScienceUtsav <no-reply@scienceutsav.com>", // Update this to your verified domain
        to: [email],
        subject: "Your verification code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to ScienceUtsav</h2>
            <p style="color: #666; font-size: 16px;">Your verification code is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #000;">${token}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
      }
    } catch (error) {
      throw new Error(`Email delivery failed: ${JSON.stringify(error)}`);
    }
  },
});