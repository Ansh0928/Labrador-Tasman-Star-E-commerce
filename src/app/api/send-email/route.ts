import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { emails, subject, message } = await req.json();

    if (!emails || emails.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No emails provided' });
    }

    const results = await Promise.allSettled(
      emails.map((to: string) =>
        resend.emails.send({
          from: 'Tasman Star Seafoods <onboarding@resend.dev>',
          to,
          subject: subject || "Special Offer from Tasman Star Seafoods",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #1a1a1a; padding: 32px 24px; text-align: center;">
                <img
                  src="https://tasman-star-seafoods.vercel.app/images/logo.png"
                  alt="Tasman Star Seafoods"
                  width="110"
                  height="110"
                  style="display: block; margin: 0 auto 16px; border-radius: 50%;"
                />
                <h1 style="color: #ffffff; margin: 0 0 4px; font-size: 22px; letter-spacing: 0.5px;">Tasman Star Seafoods</h1>
                <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 13px;">Fresh Seafood, Daily Catch</p>
              </div>

              <div style="padding: 36px 32px; background: #fff; border-left: 1px solid #eee; border-right: 1px solid #eee;">
                <p style="font-size: 16px; line-height: 1.7; color: #222; white-space: pre-line; margin: 0;">${message}</p>
              </div>

              <div style="background: #f7f7f7; padding: 24px 32px; border: 1px solid #eee; border-top: none; text-align: center;">
                <p style="margin: 0 0 6px; font-size: 13px; color: #444; font-weight: bold;">Tasman Star Seafoods</p>
                <p style="margin: 0 0 4px; font-size: 12px; color: #666;">5-7 Olsen Ave, Labrador QLD 4215</p>
                <p style="margin: 0 0 16px; font-size: 12px; color: #666;">(07) 5529 2500</p>
                <p style="margin: 0; font-size: 11px; color: #aaa;">
                  You received this because you opted in at Tasman Star Seafoods.
                </p>
              </div>
            </div>
          `,
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || String(r.reason));

    if (errors.length > 0) console.error('Email errors:', errors);

    return NextResponse.json({ success: true, sent, failed });
  } catch (error: any) {
    console.error('Email send error:', error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to send emails' }, { status: 500 });
  }
}
