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

interface Customer {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  optIn: boolean;
  signupDate: Timestamp | null;
}

interface SentMessage {
  id: string;
  text: string;
  sentAt: Timestamp | null;
  recipientCount: number;
}

const TEMPLATES = [
  { label: "🐟 Today's Fresh Catch", text: "🐟 Today's Fresh Catch at Tasman Star Seafoods!\n\nJust landed: Wild-caught Barramundi, Tiger Prawns, and Atlantic Salmon. Come in today for the freshest picks — first in, best dressed!" },
  { label: "🎉 Weekend Special", text: "🎉 Weekend Special at Tasman Star Seafoods!\n\nThis weekend only: Buy 2kg of any fish and get 500g FREE! Plus, try our new house-smoked salmon. See you there!" },
  { label: "🆕 New Arrival", text: "🆕 New Arrival at Tasman Star Seafoods!\n\nWe've just received a shipment of premium Blue Swimmer Crab and Yellowtail Kingfish. Limited stock — swing by before they're gone!" },
];

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

  // Auth check
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
      // Load customers
      const custSnap = await getDocs(
        query(collection(db, "customers"), orderBy("signupDate", "desc"), limit(50))
      );
      const custData: Customer[] = custSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Customer[];
      setCustomers(custData);

      // Load sent messages
      const msgSnap = await getDocs(
        query(collection(db, "messages"), orderBy("sentAt", "desc"), limit(20))
      );
      const msgData: SentMessage[] = msgSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SentMessage[];
      setMessages(msgData);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // Show toast
  function showToast(type: string, text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }

  // Send message
  async function handleSendMessage() {
    if (!messageText.trim()) {
      showToast("error", "Please write a message first.");
      return;
    }

    setSending(true);
    try {
      const optedInCount = customers.filter((c) => c.optIn).length;

      await addDoc(collection(db, "messages"), {
        text: messageText.trim(),
        sentAt: serverTimestamp(),
        recipientCount: optedInCount,
        sentBy: user?.email || "admin",
      });

      showToast("success", `Message sent to ${optedInCount} customers!`);
      setMessageText("");
      await loadData();
    } catch (err) {
      console.error("Error sending message:", err);
      showToast("error", "Failed to send message. Try again.");
    }
    setSending(false);
  }

  // Logout
  async function handleLogout() {
    await signOut(auth);
    router.push("/admin/login");
  }

  // Format date
  function formatDate(ts: Timestamp | null) {
    if (!ts) return "—";
    const d = ts.toDate();
    return d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatDateTime(ts: Timestamp | null) {
    if (!ts) return "—";
    const d = ts.toDate();
    return d.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Stats
  const totalCustomers = customers.length;
  const messagesToday = messages.filter((m) => {
    if (!m.sentAt) return false;
    const d = m.sentAt.toDate();
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;
  const signupsThisWeek = customers.filter((c) => {
    if (!c.signupDate) return false;
    const d = c.signupDate.toDate();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;

  // Loading / Not auth
  if (!authChecked) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return null;

  const todayStr = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="admin-layout">
      {/* Toast notification */}
      {toast && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.text}
        </div>
      )}

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <Image src="/images/logo.png" alt="Tasman Star Seafoods" width={40} height={40} className="brand-logo" />
          <div className="brand-text">
            <div className="store-name">Tasman Star</div>
            <div className="store-sub">Store Admin</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${activeNav === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveNav("dashboard")}
          >
            <span className="link-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`sidebar-link ${activeNav === "customers" ? "active" : ""}`}
            onClick={() => setActiveNav("customers")}
          >
            <span className="link-icon">👥</span>
            Customers
          </button>
          <button
            className={`sidebar-link ${activeNav === "messages" ? "active" : ""}`}
            onClick={() => setActiveNav("messages")}
          >
            <span className="link-icon">💬</span>
            Send Message
          </button>
          <button
            className={`sidebar-link ${activeNav === "settings" ? "active" : ""}`}
            onClick={() => setActiveNav("settings")}
          >
            <span className="link-icon">⚙️</span>
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <h1>
            {activeNav === "dashboard" && "Dashboard"}
            {activeNav === "customers" && "Customers"}
            {activeNav === "messages" && "Send Message"}
            {activeNav === "settings" && "Settings"}
          </h1>
          <span className="admin-date">{todayStr}</span>
        </header>

        {activeNav === "dashboard" && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card animate-fade-in-up" style={{ animationDelay: "0s" }}>
                <div className="stat-label">Total Customers</div>
                <div className="stat-value">{totalCustomers.toLocaleString()}</div>
                <div className="stat-change">All time signups</div>
              </div>
              <div className="stat-card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <div className="stat-label">Messages Sent Today</div>
                <div className="stat-value">{messagesToday}</div>
                <div className="stat-change">Via dashboard</div>
              </div>
              <div className="stat-card animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <div className="stat-label">New Signups This Week</div>
                <div className="stat-value">{signupsThisWeek}</div>
                <div className="stat-change">Last 7 days</div>
              </div>
            </div>

            {/* Dashboard Grid: Compose + Customers */}
            <div className="dashboard-grid">
              {/* Compose Message snippet */}
              <div className="compose-card">
                <h2>Quick Send</h2>
                <p className="compose-sub">Send a message to all opted-in customers</p>

                <textarea
                  placeholder="🐟 Fresh Atlantic Salmon just arrived! Come visit Tasman Star today..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  maxLength={500}
                />

                <div className="template-chips">
                  {TEMPLATES.slice(0, 2).map((tpl) => (
                    <button key={tpl.label} className="chip" onClick={() => setMessageText(tpl.text)} type="button">
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <div className="compose-actions">
                  <button
                    className={`btn-primary ${sending ? "btn-loading" : ""}`}
                    onClick={handleSendMessage}
                    disabled={sending}
                  >
                    {sending ? "Sending..." : "📤 Quick Send"}
                  </button>
                  <span className="char-count">{messageText.length}/500</span>
                </div>
              </div>

              {/* Recent Customers snippet */}
              <div className="customers-card">
                <h2>Recent Signups</h2>
                <p className="customers-sub">Latest customers from QR code</p>

                {customers.length === 0 ? (
                  <div className="no-customers">
                    <p>No customers yet. Share your QR code!</p>
                  </div>
                ) : (
                  <div className="customers-table-wrapper">
                    <table className="customers-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Opted In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.slice(0, 8).map((c) => (
                          <tr key={c.id}>
                            <td className="customer-name">{c.fullName}</td>
                            <td>{c.mobile}</td>
                            <td>
                              <span className={`customer-badge ${c.optIn ? "opted-in" : "opted-out"}`}>
                                {c.optIn ? "Yes" : "No"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeNav === "customers" && (
          <div className="customers-card animate-fade-in-up">
            <h2>All Customers</h2>
            <p className="customers-sub">Complete list of registered customers</p>

            {customers.length === 0 ? (
              <div className="no-customers">
                <p>No customers yet. Share your QR code!</p>
              </div>
            ) : (
              <div className="customers-table-wrapper">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Signed Up</th>
                      <th>Opted In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="customer-name">{c.fullName}</td>
                        <td>{c.mobile}</td>
                        <td>{c.email || "—"}</td>
                        <td>{formatDate(c.signupDate)}</td>
                        <td>
                          <span className={`customer-badge ${c.optIn ? "opted-in" : "opted-out"}`}>
                            {c.optIn ? "Yes" : "No"}
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

        {activeNav === "messages" && (
          <div className="animate-fade-in-up">
            <div className="compose-card" style={{ marginBottom: "2rem" }}>
              <h2>Send Special Offer</h2>
              <p className="compose-sub">Compose a detailed message to all {customers.filter(c => c.optIn).length} opted-in customers</p>

              <textarea
                placeholder="🐟 Fresh Atlantic Salmon just arrived! Come visit Tasman Star today..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                maxLength={500}
                style={{ minHeight: "180px" }}
              />

              <div className="template-chips">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.label} className="chip" onClick={() => setMessageText(tpl.text)} type="button">
                    {tpl.label}
                  </button>
                ))}
              </div>

              <div className="compose-actions">
                <button
                  className={`btn-primary ${sending ? "btn-loading" : ""}`}
                  onClick={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? "Sending..." : "📤 Send Message to All"}
                </button>
                <span className="char-count">{messageText.length}/500</span>
              </div>
            </div>

            {/* Recent Messages */}
            {messages.length > 0 && (
              <div className="messages-log">
                <h2>Message History</h2>
                {messages.map((m) => (
                  <div key={m.id} className="message-item">
                    <p className="message-text">{m.text}</p>
                    <p className="message-meta">
                      Sent to {m.recipientCount} customers • {formatDateTime(m.sentAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "settings" && (
          <div className="compose-card animate-fade-in-up">
            <h2>Store Settings</h2>
            <p className="compose-sub">Manage your admin profile and account.</p>
            
            <div style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
              <div>
                <label className="input-label">Admin Email</label>
                <input className="input-field" type="email" value={user?.email || ""} disabled style={{ opacity: 0.7 }} />
              </div>
              <div>
                <label className="input-label">Password</label>
                <button className="btn-secondary" style={{ width: "100%" }}>Reset Password</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
