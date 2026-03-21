"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./signup.css";

// ── Carousel data ──────────────────────────────────────────────
const FEATURES = [
  { id: "prawns",     icon: "🍤", label: "Wild Prawns",        image: "/images/carousel/prawns.webp",    desc: "Wild-caught, never farmed." },
  { id: "oyster",     icon: "🦪", label: "Pacific Oysters",    image: "/images/carousel/oyster.png",     desc: "Freshly shucked, straight from the shell." },
  { id: "fillets",    icon: "🐠", label: "Fish Fillets",       image: "/images/carousel/fillets.png",    desc: "Fresh-cut fillets, no freezing ever." },
  { id: "bowl",       icon: "🍱", label: "Seafood Bowls",      image: "/images/carousel/bowl.png",       desc: "Ready-to-eat meals made fresh daily." },
  { id: "trawlers",   icon: "⚓", label: "Local Trawlers",     image: "/images/carousel/trawlers.png",   desc: "Straight from Gold Coast fishing boats." },
  { id: "store",      icon: "🏪", label: "Visit Our Store",    image: "/images/carousel/storefront.jpg", desc: "5-7 Olsen Ave, Labrador QLD 4215." },
  { id: "shellfish",  icon: "🐙", label: "Shellfish & More",   image: "/images/carousel/shellfish.webp", desc: "Oysters, mussels & more, freshly shucked." },
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
  const [active, setActive]   = useState(0);
  const [slots, setSlots]     = useState<{ src: string; key: number }[]>([
    { src: FEATURES[0].image, key: 0 },
  ]);
  const [paused, setPaused]   = useState(false);
  const activeRef             = useRef(active);
  activeRef.current           = active;
  const keyRef                = useRef(1);

  const goTo = (idx: number) => {
    const n = ((idx % N) + N) % N;
    setActive(n);
    const newKey = keyRef.current++;
    // Keep previous slot for exit animation, push new slot on top
    setSlots((prev) => [...prev.slice(-1), { src: FEATURES[n].image, key: newKey }]);
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

  return { active, slots, paused, setPaused, goTo, chipStyle };
}

// ── Component ──────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();

  const { active, slots, paused, setPaused, goTo, chipStyle } =
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
        <div className="chip-col" ref={(el) => {
          if (!el) return;
          const activeBtn = el.querySelector<HTMLElement>(".carousel-chip.active");
          if (activeBtn) activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }}>
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
            {slots.map((slot, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slot.key}
                src={slot.src}
                alt={current.label}
                className={i === slots.length - 1 ? "photo-img photo-img-enter" : "photo-img photo-img-exit"}
              />
            ))}
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
