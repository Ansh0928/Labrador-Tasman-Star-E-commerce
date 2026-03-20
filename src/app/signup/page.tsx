"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./signup.css";

// ── Carousel data ──────────────────────────────────────────────
const FEATURES = [
  { id: "lobster",    icon: "🦞", label: "Live Lobster",       image: "/images/carousel/lobster.png",    desc: "Straight from the tank, always alive." },
  { id: "catch",      icon: "🐟", label: "Fresh Catch Daily",  image: "/images/carousel/catch.png",      desc: "Straight off the boat, every morning." },
  { id: "prawns",     icon: "🍤", label: "Wild Prawns",        image: "/images/carousel/prawns.webp",    desc: "Wild-caught, never farmed." },
  { id: "fillets",    icon: "🐠", label: "Fish Fillets",       image: "/images/carousel/fillets.png",    desc: "Fresh-cut fillets, no freezing ever." },
  { id: "crab",       icon: "🦀", label: "Blue Swimmer Crab",  image: "/images/carousel/crab.png",       desc: "Queensland's finest blue swimmers." },
  { id: "shellfish",  icon: "🐙", label: "Shellfish",          image: "/images/carousel/shellfish.webp", desc: "Oysters, mussels & more, freshly shucked." },
  { id: "fishermen",  icon: "⚓", label: "Local Fishermen",    image: "/images/carousel/fishermen.png",  desc: "Supporting Gold Coast fishing families." },
];

const N = FEATURES.length;
const INTERVAL = 2800;

// ── Push helper ────────────────────────────────────────────────
const urlB64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
};

// ── Carousel hook ──────────────────────────────────────────────
function useCarousel() {
  const [active, setActive]       = useState(2);
  const [imgSrc, setImgSrc]       = useState(FEATURES[2].image);
  const [imgFade, setImgFade]     = useState(true);
  const [paused, setPaused]       = useState(false);
  const activeRef                 = useRef(active);
  activeRef.current               = active;

  const goTo = (idx: number) => {
    const n = ((idx % N) + N) % N;
    setActive(n);
    setImgFade(false);
    setTimeout(() => { setImgSrc(FEATURES[n].image); setImgFade(true); }, 220);
  };

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => goTo(activeRef.current + 1), INTERVAL);
    return () => clearInterval(id);
  }, [paused]);

  const chipStyle = (i: number) => {
    let d = i - active;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    return {
      opacity: Math.max(0.18, 1 - Math.abs(d) * 0.2),
      transform: `translateY(${d * 3}px) scale(${i === active ? 1 : 0.97})`,
    };
  };

  return { active, imgSrc, imgFade, paused, setPaused, goTo, chipStyle };
}

// ── Component ──────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();

  const { active, imgSrc, imgFade, paused, setPaused, goTo, chipStyle } =
    useCarousel();

  const [fullName, setFullName] = useState("");
  const [mobile,   setMobile]   = useState("");
  const [email,    setEmail]     = useState("");
  const [optIn,    setOptIn]     = useState(true);
  const [loading,  setLoading]   = useState(false);
  const [error,    setError]     = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!fullName.trim() || !mobile.trim()) {
      setError("Please fill in your name and mobile number.");
      return;
    }
    setLoading(true);
    try {
      let pushSubscription = null;
      if (optIn && "serviceWorker" in navigator && "PushManager" in window) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          const sub = await Promise.race([
            reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
              ),
            }),
            new Promise<never>((_, r) =>
              setTimeout(() => r(new Error("timeout")), 5000)
            ),
          ]);
          pushSubscription = JSON.parse(JSON.stringify(sub));
        } catch {
          console.warn("Push subscription skipped");
        }
      }

      const data: Record<string, unknown> = {
        fullName: fullName.trim(),
        mobile:   mobile.trim(),
        email:    email.trim().toLowerCase(),
        optIn,
        signupDate: serverTimestamp(),
        source: "qr-code",
      };
      if (pushSubscription) data.pushSubscription = pushSubscription;

      await addDoc(collection(db, "customers"), data);
      router.push("/thank-you");
    } catch (err: unknown) {
      setError(`Signup failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setLoading(false);
    }
  }

  const current = FEATURES[active];

  return (
    <div className="signup-page">

      {/* ── LEFT: Carousel ── */}
      <aside className="carousel-side">
        <div className="carousel-fade-top" />
        <div className="carousel-fade-bot" />
        <span className="carousel-live">
          <span className="carousel-live-dot" />
          Live
        </span>

        {/* Chip column */}
        <div className="chip-col">
          {FEATURES.map((f, i) => (
            <button
              key={f.id}
              className={`carousel-chip${i === active ? " active" : ""}`}
              style={chipStyle(i)}
              onClick={() => goTo(i)}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <span className="chip-icon">{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* Photo card */}
        <div className="photo-col">
          <div className="photo-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={current.label}
              style={{ opacity: imgFade ? 1 : 0 }}
            />
            <div className="photo-caption">
              <div className="photo-badge">
                {active + 1} • {current.label}
              </div>
              <p className="photo-desc">{current.desc}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT: Form ── */}
      <main className="form-side">
        <div className="form-inner">

          <div className="brand">
            <Image
              src="/images/logo.png"
              alt="Tasman Star Seafoods"
              width={52}
              height={52}
              className="brand-logo"
              priority
            />
            <div>
              <div className="brand-name">Tasman Star Seafoods</div>
              <div className="brand-addr">5-7 Olsen Ave, Labrador QLD 4215</div>
              <a href="tel:0755292500" className="brand-phone">(07) 5529 2500</a>
            </div>
          </div>

          <h1 className="form-headline">
            Join the <span>Crew</span>
          </h1>
          <p className="form-sub">
            Get exclusive daily specials and fresh catch alerts.
          </p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="form-field">
              <label htmlFor="mobile">Mobile Number</label>
              <input
                id="mobile"
                type="tel"
                placeholder="+61 400 123 456"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>

            <div className="form-field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="consent-row">
              <input
                type="checkbox"
                id="optIn"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
              />
              <label htmlFor="optIn">
                <span>
                  I&apos;d like to receive daily specials &amp; fresh catch alerts via SMS/Email
                </span>
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? <><span className="btn-spinner" /> Joining...</>
                : "Join the Crew →"
              }
            </button>
          </form>

          <p className="form-footer">
            © {new Date().getFullYear()} Tasman Star Seafoods. Freshness guaranteed.
          </p>
        </div>
      </main>
    </div>
  );
}
