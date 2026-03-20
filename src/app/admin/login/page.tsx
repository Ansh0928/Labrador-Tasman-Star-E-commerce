"use client";

import { useState, FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./login.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin");
    } catch {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleLogin} noValidate>
        <div className="admin-login-header">
          <Image
            src="/images/logo.png"
            alt="Tasman Star Seafoods"
            width={80}
            height={80}
            className="login-logo"
          />
          <h1>Admin Portal</h1>
          <p>Sign in to manage your store</p>
        </div>

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
          <label className="input-label" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            className="input-field"
            placeholder="admin@tasmanstar.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="input-label" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className={`btn-primary ${loading ? "btn-loading" : ""}`}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
