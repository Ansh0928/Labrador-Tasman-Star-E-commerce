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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #FF6B00; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">Tasman Star Seafoods</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0;">Fresh Seafood, Daily Catch</p>
              </div>
              <div style="padding: 32px 24px; background: #fff;">
                <p style="font-size: 16px; line-height: 1.6; color: #222; white-space: pre-line;">${message}</p>
              </div>
              <div style="background: #1a1a1a; padding: 16px; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">
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
