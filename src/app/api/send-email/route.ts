import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { emails, subject, message } = await req.json();

    if (!emails || emails.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No emails provided" });
    }

    // Configure the SMTP transporter using environment variables.
    // User needs to provide SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.
    // If using Gmail, it's recommended to create an App Password.
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // To protect privacy, we use BCC so recipients don't see each other's emails
    const mailOptions = {
      from: `"Tasman Star Seafoods" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Send to the admin's own email on the "to" line
      bcc: emails,               // BCC all the customers
      subject: subject || "Special Offer from Tasman Star Seafoods",
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #FF5A00; text-align: center; margin-bottom: 24px;">Tasman Star Seafoods</h2>
          <div style="font-size: 16px; line-height: 1.6; color: #333; white-space: pre-wrap;">
            ${message}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px; margin-bottom: 24px;">
          <p style="text-align: center; font-size: 12px; color: #888;">
            You are receiving this because you signed up for alerts from Tasman Star Seafoods.
          </p>
        </div>
      `,
    };

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials missing. Email was requested but not sent.");
      return NextResponse.json({ success: false, error: 'SMTP credentials missing' }, { status: 500 });
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Bulk email sent. MessageId:", info.messageId);

    return NextResponse.json({ success: true, count: emails.length });
  } catch (error) {
    console.error('Error sending emails via Nodemailer:', error);
    return NextResponse.json({ success: false, error: 'Failed to send emails' }, { status: 500 });
  }
}
