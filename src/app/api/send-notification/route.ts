import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configuration
webpush.setVapidDetails(
  'mailto:admin@tasmanstar.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const { title, message, subscriptions, url } = await req.json();

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No subscriptions provided" });
    }

    const payload = JSON.stringify({
      title: title || 'Tasman Star Seafoods',
      body: message,
      url: url || '/',
    });

    const sendPromises = subscriptions.map((sub: webpush.PushSubscription) => 
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('Push error for sub', sub.endpoint, err);
        return null;
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json({ success: false, error: 'Failed to send notifications' }, { status: 500 });
  }
}
