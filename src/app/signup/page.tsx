"use client";

import { useState, FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./signup.css";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !mobile.trim()) {
      setError("Please fill in your name and mobile number.");
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "customers"), {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim().toLowerCase(),
        optIn,
        signupDate: serverTimestamp(),
        source: "qr-code",
      });

      router.push("/thank-you");
    } catch (err) {
      console.error("Signup error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="signup-page">
      {/* Hero Background Image */}
      <div className="signup-hero-bg">
        <Image
          src="/images/hero-seafood.png"
          alt="Fresh seafood display"
          fill
          style={{ objectFit: "cover" }}
          priority
        />
        <div className="hero-overlay" />
      </div>

      {/* Logo + Hero */}
      <header className="signup-hero">
        <div className="logo-wrapper">
          <Image
            src="/images/logo.png"
            alt="Tasman Star Seafoods"
            width={140}
            height={140}
            className="store-logo"
            priority
          />
        </div>
        <p className="tagline">Fresh Seafood, Daily Catch</p>
      </header>

      {/* Signup Form */}
      <main className="signup-form-wrapper">
        <form className="signup-form-card" onSubmit={handleSubmit} noValidate>
          <h2 className="form-title">Join the Crew</h2>
          <p className="form-subtitle">
            Get exclusive daily specials and fresh catch alerts.
          </p>

          {error && (
            <div className="toast-error" style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: '0.8125rem'
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="input-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="input-field"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="mobile">Mobile Number</label>
            <input
              id="mobile"
              type="tel"
              className="input-field"
              placeholder="+61 400 123 456"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="consent-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
              />
              <span className="checkbox-label-text">
                I&apos;d like to receive daily specials &amp; fresh catch alerts via SMS/Email
              </span>
            </label>
          </div>

          <button
            type="submit"
            className={`btn-primary ${loading ? "btn-loading" : ""}`}
            disabled={loading}
          >
            {loading ? "Joining..." : "Join the Crew"}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="signup-footer">
        <p>© {new Date().getFullYear()} Tasman Star Seafoods. Freshness guaranteed.</p>
      </footer>
    </div>
  );
}
