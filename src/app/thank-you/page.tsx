import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import "./thankyou.css";

export const metadata: Metadata = {
  title: "Welcome to the Crew! — Tasman Star Seafoods",
  description: "You're now on the list for our freshest daily catches and exclusive specials.",
};

export default function ThankYouPage() {
  return (
    <div className="thankyou-page">
      {/* Background Image */}
      <div className="thankyou-bg">
        <Image
          src="/images/thankyou-seafood.png"
          alt="Premium seafood platter"
          fill
          style={{ objectFit: "cover" }}
          priority
        />
        <div className="thankyou-overlay" />
      </div>

      <div className="thankyou-content">
        <div className="thankyou-logo">
          <Image
            src="/images/logo.png"
            alt="Tasman Star Seafoods"
            width={100}
            height={100}
            className="store-logo"
          />
        </div>

        <h1 className="thankyou-heading">
          Welcome to<br />the Crew!
        </h1>

        <p className="thankyou-message">
          Thank you for joining <strong>Tasman Star Seafoods</strong>. You&apos;re now on the list for our{" "}
          <strong>freshest daily catches</strong> and{" "}
          <strong>exclusive specials</strong>. We&apos;ll let you know when
          something amazing arrives at the store.
        </p>

        <div className="thankyou-actions">
          <Link href="/signup" className="btn-secondary">
            ← Back to Signup
          </Link>
        </div>
      </div>

      <footer className="thankyou-footer">
        <p>© {new Date().getFullYear()} Tasman Star Seafoods</p>
      </footer>
    </div>
  );
}
