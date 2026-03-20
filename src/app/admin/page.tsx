"use client";

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./admin.css";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  optIn: boolean;
  pushSubscription?: unknown;
  signupDate: Timestamp | null;
}

interface SentMessage {
  id: string;
  text: string;
  sentAt: Timestamp | null;
  recipientCount: number;
  emailCount?: number;
  pushCount?: number;
}

// ─── Templates ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  { label: "🐟 Fresh Catch", text: "🐟 Today's Fresh Catch at Tasman Star Seafoods!\n\nJust landed: Wild-caught Barramundi, Tiger Prawns, and Atlantic Salmon. Come in today for the freshest picks — first in, best dressed!" },
  { label: "🎉 Weekend Special", text: "🎉 Weekend Special at Tasman Star Seafoods!\n\nThis weekend only: Buy 2kg of any fish and get 500g FREE! Plus, try our new house-smoked salmon. See you there!" },
  { label: "🆕 New Arrival", text: "🆕 New Arrival at Tasman Star Seafoods!\n\nWe've just received a shipment of premium Blue Swimmer Crab and Yellowtail Kingfish. Limited stock — swing by before they're gone!" },
];

// ─── Recommendations engine ──────────────────────────────────────────────────
interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  body: string;
  action?: string;
  template?: string;
}

function buildRecommendations(
  customers: Customer[],
  messages: SentMessage[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = now.getHours();
  const optedIn = customers.filter((c) => c.optIn).length;

  // Last message sent
  const lastMsg = messages[0];
  const lastSentDate = lastMsg?.sentAt?.toDate();
  const daysSinceLast = lastSentDate
    ? Math.floor((now.getTime() - lastSentDate.getTime()) / 86400000)
    : null;

  // 1. Overdue nudge
  if (daysSinceLast === null) {
    recs.push({
      id: "no-messages",
      priority: "high",
      title: "Send your first message",
      body: `You have ${optedIn} opted-in customers waiting. Send them a welcome offer to get started.`,
      action: "Send Now",
      template: TEMPLATES[0].text,
    });
  } else if (daysSinceLast >= 7) {
    recs.push({
      id: "overdue",
      priority: "high",
      title: `${daysSinceLast} days since last message`,
      body: "Customers who haven't heard from you in a week are more likely to forget you. Re-engage now.",
      action: "Send Now",
      template: TEMPLATES[0].text,
    });
  } else if (daysSinceLast >= 3) {
    recs.push({
      id: "due-soon",
      priority: "medium",
      title: "Good time for a fresh message",
      body: `Last sent ${daysSinceLast} days ago. A mid-week update keeps customers engaged.`,
      action: "Compose",
    });
  }

  // 2. Day-of-week timing
  if (day === 5 && hour < 14) {
    recs.push({
      id: "friday",
      priority: "high",
      title: "It's Friday — perfect for a weekend special",
      body: "Friday messages before 2pm get the best open rates. Customers plan weekend shopping now.",
      action: "Use Template",
      template: TEMPLATES[1].text,
    });
  } else if (day === 6 || day === 0) {
    recs.push({
      id: "weekend",
      priority: "medium",
      title: "Weekend shoppers are out",
      body: "Seafood sells fastest on weekends. A quick fresh-catch message drives foot traffic today.",
      action: "Use Template",
      template: TEMPLATES[0].text,
    });
  } else if (day === 1) {
    recs.push({
      id: "monday",
      priority: "low",
      title: "New week, new stock",
      body: "Monday is a great day to announce new arrivals and set the tone for the week.",
      action: "Use Template",
      template: TEMPLATES[2].text,
    });
  }

  // 3. List health
  const optInRate = customers.length ? (optedIn / customers.length) * 100 : 0;
  if (customers.length > 0 && optInRate < 70) {
    recs.push({
      id: "opt-in-rate",
      priority: "medium",
      title: "Opt-in rate below 70%",
      body: `Only ${Math.round(optInRate)}% of customers are opted in. Consider asking in-store to improve reach.`,
    });
  }

  // 4. New signups
  const newThisWeek = customers.filter((c) => {
    if (!c.signupDate) return false;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return c.signupDate.toDate() >= weekAgo;
  }).length;
  if (newThisWeek >= 3) {
    recs.push({
      id: "new-signups",
      priority: "low",
      title: `${newThisWeek} new signups this week`,
      body: "Great momentum! Send a welcome offer to convert new subscribers into repeat customers.",
      action: "Welcome Them",
      template: "🎉 Welcome to Tasman Star Seafoods!\n\nThank you for signing up. As a new member, enjoy a special offer: 10% off your next purchase. Come visit us and mention this message at the counter!",
    });
  }

  // 5. Best send time hint
  if (hour >= 9 && hour <= 11 && daysSinceLast !== 0) {
    recs.push({
      id: "best-time",
      priority: "low",
      title: "Prime send window open",
      body: "9am–11am gets the highest message open rates. If you're planning to send today, now is the time.",
    });
  }

  return recs.slice(0, 4); // max 4 shown
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const IconGrid = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const IconSendMsg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitial(name: string) {
  return name?.charAt(0)?.toUpperCase() || "?";
}

function formatDate(ts: Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(ts: Timestamp | null) {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const [activeNav, setActiveNav] = useState("dashboard");

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (!u) router.push("/admin/login");
    });
    return () => unsub();
  }, [router]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const custSnap = await getDocs(
        query(collection(db, "customers"), orderBy("signupDate", "desc"), limit(50))
      );
      setCustomers(custSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Customer[]);

      const msgSnap = await getDocs(
        query(collection(db, "messages"), orderBy("sentAt", "desc"), limit(20))
      );
      setMessages(msgSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as SentMessage[]);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  function showToast(type: string, text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSendMessage() {
    if (!messageText.trim()) {
      showToast("error", "Please write a message first.");
      return;
    }
    setSending(true);
    try {
      const targets = customers.filter((c) => c.optIn);
      const pushSubs = targets.map((c) => c.pushSubscription).filter(Boolean);
      const emails = targets.map((c) => c.email).filter(Boolean);

      if (pushSubs.length > 0) {
        try {
          await fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Tasman Star Seafoods", message: messageText.trim(), subscriptions: pushSubs, url: "https://tasman-star-seafoods.vercel.app/" }),
          });
        } catch {}
      }

      if (emails.length > 0) {
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emails, subject: "Special Offer from Tasman Star Seafoods", message: messageText.trim() }),
          });
        } catch {}
      }

      await addDoc(collection(db, "messages"), {
        text: messageText.trim(),
        sentAt: serverTimestamp(),
        recipientCount: targets.length,
        pushCount: pushSubs.length,
        emailCount: emails.length,
        sentBy: user?.email || "admin",
      });

      showToast("success", `Sent to ${targets.length} customers (${emails.length} email, ${pushSubs.length} push)`);
      setMessageText("");
      await loadData();
    } catch {
      showToast("error", "Failed to send. Please try again.");
    }
    setSending(false);
  }

  async function handleLogout() {
    await signOut(auth);
    router.push("/admin/login");
  }

  // Recommendations
  const recommendations = buildRecommendations(customers, messages);

  // Stats
  const totalCustomers = customers.length;
  const optedIn = customers.filter((c) => c.optIn).length;
  const messagesToday = messages.filter((m) => {
    if (!m.sentAt) return false;
    return m.sentAt.toDate().toDateString() === new Date().toDateString();
  }).length;
  const signupsThisWeek = customers.filter((c) => {
    if (!c.signupDate) return false;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return c.signupDate.toDate() >= weekAgo;
  }).length;

  const todayStr = new Date().toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

  const navItems = [
    { id: "dashboard", label: "Dashboard", Icon: IconGrid },
    { id: "customers", label: "Customers", Icon: IconUsers },
    { id: "messages",  label: "Send Message", Icon: IconSend },
    { id: "settings",  label: "Settings", Icon: IconSettings },
  ];

  const pageTitle: Record<string, string> = {
    dashboard: "Dashboard",
    customers: "Customers",
    messages: "Send Message",
    settings: "Settings",
  };

  // Loading
  if (!authChecked) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
      </div>
    );
  }
  if (!user) return null;

  const adminInitial = (user.email || "A").charAt(0).toUpperCase();

  return (
    <div className="admin-layout">
      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.type === "success" ? <IconCheck /> : <IconX />}
          {toast.text}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <Image src="/images/logo.png" alt="Tasman Star" width={38} height={38} />
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sidebar-link ${activeNav === id ? "active" : ""}`}
              data-tip={label}
              onClick={() => setActiveNav(id)}
              aria-label={label}
            >
              <Icon />
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-divider" />
          <div className="sidebar-avatar">{adminInitial}</div>
          <button className="logout-btn" onClick={handleLogout} aria-label="Sign Out">
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Admin</span>
            <span className="breadcrumb-sep">›</span>
            <span className="page-title">{pageTitle[activeNav]}</span>
          </div>
          <div className="topbar-right">
            <span className="date-chip">{todayStr}</span>
            <button className="refresh-btn" onClick={loadData} aria-label="Refresh">
              <IconRefresh />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="admin-content">

          {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <>
              {/* Stats Row */}
              <div className="stats-grid">
                <div className="stat-card fade-up">
                  <div className="stat-icon"><IconUsers /></div>
                  <div className="stat-label">Total Customers</div>
                  <div className="stat-value">{totalCustomers}</div>
                  <div className="stat-change"><span className="neutral">All time signups</span></div>
                </div>
                <div className="stat-card fade-up fade-up-1">
                  <div className="stat-icon"><IconCheck /></div>
                  <div className="stat-label">Opted In</div>
                  <div className="stat-value">{optedIn}</div>
                  <div className="stat-change">
                    <span className="up">{totalCustomers ? Math.round((optedIn / totalCustomers) * 100) : 0}%</span> opt-in rate
                  </div>
                </div>
                <div className="stat-card fade-up fade-up-2">
                  <div className="stat-icon"><IconSendMsg /></div>
                  <div className="stat-label">Sent Today</div>
                  <div className="stat-value">{messagesToday}</div>
                  <div className="stat-change"><span className="neutral">Via dashboard</span></div>
                </div>
                <div className="stat-card fade-up fade-up-3">
                  <div className="stat-icon"><IconBell /></div>
                  <div className="stat-label">New This Week</div>
                  <div className="stat-value">{signupsThisWeek}</div>
                  <div className="stat-change"><span className="neutral">Last 7 days</span></div>
                </div>
              </div>

              {/* Grid */}
              <div className="dashboard-grid fade-up fade-up-4">
                {/* Compose */}
                <div className="panel compose-panel">
                  <div className="panel-title">Quick Send</div>
                  <div className="panel-sub">Compose a message to all {optedIn} opted-in customers</div>
                  <textarea
                    placeholder="🐟 Fresh Atlantic Salmon just arrived! Come visit Tasman Star today..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    maxLength={500}
                  />
                  <div className="template-chips">
                    {TEMPLATES.slice(0, 2).map((t) => (
                      <button key={t.label} className="chip" onClick={() => setMessageText(t.text)} type="button">
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="compose-footer">
                    <button className="btn-send" onClick={handleSendMessage} disabled={sending}>
                      <IconSendMsg />
                      {sending ? "Sending…" : "Send to All"}
                    </button>
                    <span className="char-count">{messageText.length}/500</span>
                  </div>
                </div>

                {/* Recent Signups */}
                <div className="panel">
                  <div className="panel-title">Recent Signups</div>
                  <div className="panel-sub">Latest from QR code</div>
                  {customers.length === 0 ? (
                    <div className="empty-state">
                      <IconUsers />
                      <p>No customers yet — share your QR code!</p>
                    </div>
                  ) : (
                    <div className="customers-list">
                      {customers.slice(0, 7).map((c) => (
                        <div key={c.id} className="customer-row">
                          <div className="customer-initial">{getInitial(c.fullName)}</div>
                          <div className="customer-info">
                            <div className="customer-name">{c.fullName}</div>
                            <div className="customer-phone">{c.mobile}</div>
                          </div>
                          <span className={`opted-badge ${c.optIn ? "yes" : "no"}`}>
                            <span className="opted-dot" />
                            {c.optIn ? "In" : "Out"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Recommendations ── */}
              {recommendations.length > 0 && (
                <div className="recs-panel fade-up">
                  <div className="recs-header">
                    <div>
                      <div className="panel-title">Smart Recommendations</div>
                      <div className="panel-sub">Based on your customers, send history, and timing</div>
                    </div>
                    <span className="recs-count">{recommendations.length} insight{recommendations.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="recs-list">
                    {recommendations.map((rec) => (
                      <div key={rec.id} className={`rec-item rec-${rec.priority}`}>
                        <div className={`rec-dot rec-dot-${rec.priority}`} />
                        <div className="rec-body">
                          <div className="rec-title">{rec.title}</div>
                          <div className="rec-text">{rec.body}</div>
                        </div>
                        {rec.action && (
                          <button
                            className="rec-action"
                            onClick={() => {
                              if (rec.template) setMessageText(rec.template);
                              setActiveNav("messages");
                            }}
                          >
                            {rec.action} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message History on Dashboard */}
              {messages.length > 0 && (
                <div className="panel fade-up">
                  <div className="panel-title">Recent Messages</div>
                  <div className="panel-sub">Last {Math.min(messages.length, 3)} sent</div>
                  <div className="message-log-list">
                    {messages.slice(0, 3).map((m) => (
                      <div key={m.id} className="message-log-item">
                        <div className="message-log-text">{m.text}</div>
                        <div className="message-log-meta">
                          <span className="message-log-pill"><IconUsers />{m.recipientCount} recipients</span>
                          {m.emailCount != null && m.emailCount > 0 && (
                            <span className="message-log-pill"><IconMail />{m.emailCount} emails</span>
                          )}
                          {m.pushCount != null && m.pushCount > 0 && (
                            <span className="message-log-pill"><IconBell />{m.pushCount} push</span>
                          )}
                          <span className="message-log-pill">{formatDateTime(m.sentAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ CUSTOMERS ══════════════════════════════════════════════════════ */}
          {activeNav === "customers" && (
            <div className="panel fade-up">
              <div className="panel-title">All Customers</div>
              <div className="panel-sub">{totalCustomers} registered · {optedIn} opted in</div>
              {customers.length === 0 ? (
                <div className="empty-state">
                  <IconUsers />
                  <p>No customers yet — share your QR code!</p>
                </div>
              ) : (
                <div className="full-table-wrapper">
                  <table className="full-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Signed Up</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id}>
                          <td className="td-name">
                            <span className="table-initial">{getInitial(c.fullName)}</span>
                            {c.fullName}
                          </td>
                          <td>{c.mobile}</td>
                          <td>{c.email || "—"}</td>
                          <td>{formatDate(c.signupDate)}</td>
                          <td>
                            <span className={`opted-badge ${c.optIn ? "yes" : "no"}`}>
                              <span className="opted-dot" />
                              {c.optIn ? "Opted In" : "Opted Out"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ SEND MESSAGE ═══════════════════════════════════════════════════ */}
          {activeNav === "messages" && (
            <div className="send-page-grid fade-up">
              {/* Compose */}
              <div className="panel compose-panel">
                <div className="panel-title">Send Special Offer</div>
                <div className="panel-sub">Reaching {optedIn} opted-in customers via email & push</div>
                <textarea
                  placeholder="🐟 Fresh Atlantic Salmon just arrived! Come visit Tasman Star today..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  maxLength={500}
                  style={{ minHeight: "160px" }}
                />
                <div className="template-chips">
                  {TEMPLATES.map((t) => (
                    <button key={t.label} className="chip" onClick={() => setMessageText(t.text)} type="button">
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="compose-footer">
                  <button className="btn-send" onClick={handleSendMessage} disabled={sending}>
                    <IconSendMsg />
                    {sending ? "Sending…" : `Send to ${optedIn} Customers`}
                  </button>
                  <span className="char-count">{messageText.length}/500</span>
                </div>
              </div>

              {/* History */}
              <div className="panel messages-section">
                <div className="panel-title">Message History</div>
                <div className="panel-sub">{messages.length} sent so far</div>
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <IconSendMsg />
                    <p>No messages sent yet</p>
                  </div>
                ) : (
                  <div className="message-log-list">
                    {messages.map((m) => (
                      <div key={m.id} className="message-log-item">
                        <div className="message-log-text">{m.text}</div>
                        <div className="message-log-meta">
                          <span className="message-log-pill"><IconUsers />{m.recipientCount}</span>
                          {m.emailCount != null && m.emailCount > 0 && (
                            <span className="message-log-pill"><IconMail />{m.emailCount} email</span>
                          )}
                          {m.pushCount != null && m.pushCount > 0 && (
                            <span className="message-log-pill"><IconBell />{m.pushCount} push</span>
                          )}
                          <span className="message-log-pill">{formatDateTime(m.sentAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ SETTINGS ═══════════════════════════════════════════════════════ */}
          {activeNav === "settings" && (
            <div className="settings-grid fade-up">
              <div className="panel">
                <div className="panel-title">Account</div>
                <div className="panel-sub">Manage your admin credentials</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label className="input-label">Admin Email</label>
                    <input className="input-field" type="email" value={user?.email || ""} disabled />
                  </div>
                  <div>
                    <label className="input-label">Password</label>
                    <button className="btn-secondary">Reset Password</button>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Store Info</div>
                <div className="panel-sub">Quick stats at a glance</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
                  {[
                    { label: "Total Customers", value: totalCustomers },
                    { label: "Opted In", value: `${optedIn} (${totalCustomers ? Math.round((optedIn / totalCustomers) * 100) : 0}%)` },
                    { label: "Messages Sent", value: messages.length },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                      <span style={{ fontSize: "12px", color: "#71717a" }}>{label}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#e4e4e7" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
