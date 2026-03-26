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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a;">

              <!-- HEADER -->
              <div style="background: #0a0a0a; padding: 40px 24px 28px; text-align: center; border-bottom: 3px solid #E8751A;">
                <img
                  src="https://tasman-star-seafoods.vercel.app/images/logo-alt.png"
                  alt="Tasman Star Seafoods"
                  width="100"
                  height="100"
                  style="display: block; margin: 0 auto 20px;"
                />
                <h1 style="color: #ffffff; margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">Tasman Star Seafoods</h1>
                <p style="color: #E8751A; margin: 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">Fresh Seafood · Daily Catch</p>
              </div>

              <!-- BODY -->
              <div style="background: #111111; padding: 40px 36px;">
                <p style="font-size: 16px; line-height: 1.8; color: #e4e4e4; white-space: pre-line; margin: 0 0 32px;">${message}</p>

                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="https://tasman-admin.vercel.app/"
                     style="display: inline-block; background: linear-gradient(135deg, #E8751A, #f59e0b); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 16px 40px; border-radius: 6px;">
                    Shop Online →
                  </a>
                </div>
              </div>

              <!-- DIVIDER -->
              <div style="height: 3px; background: linear-gradient(90deg, #E8751A, #f59e0b, #E8751A);"></div>

              <!-- FOOTER -->
              <div style="background: #0a0a0a; padding: 28px 36px; text-align: center;">
                <p style="margin: 0 0 4px; font-size: 14px; color: #ffffff; font-weight: 700; letter-spacing: 0.5px;">Tasman Star Seafoods</p>
                <p style="margin: 0 0 2px; font-size: 12px; color: #888;">5-7 Olsen Ave, Labrador QLD 4215</p>
                <p style="margin: 0 0 20px; font-size: 12px; color: #888;">(07) 5529 2500</p>
                <p style="margin: 0; font-size: 11px; color: #444;">
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
