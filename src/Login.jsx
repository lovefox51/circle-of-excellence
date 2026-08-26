import React, { useState } from "react";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "./supabaseClient";

const COLORS = {
  bg: "#12162A",
  panel: "#1A2038",
  hairline: "#2E3658",
  text: "#F2EFE7",
  textMuted: "#9AA3C4",
  gold: "#D8AA4E",
  hero: "#E0793E",
  bad: "#D9705F",
};

const inputStyle = {
  width: "100%",
  background: "#12162A",
  border: `1px solid ${COLORS.hairline}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  color: COLORS.text,
  outline: "none",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-7 rounded-2xl"
        style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
      >
        <div className="flex flex-col items-center mb-6">
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
            style={{ background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.hero})` }}
          >
            <Sparkles size={18} color="#1A1406" />
          </span>
          <h1 className="text-lg font-semibold" style={{ color: COLORS.text, fontFamily: "Fraunces, serif" }}>
            Circle of Excellence
          </h1>
          <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
            Sign in with your department account
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.textMuted }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="department.head@coe.internal"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: COLORS.textMuted }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: COLORS.bad }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm"
          style={{ background: COLORS.gold, color: "#1A1406", opacity: loading ? 0.7 : 1 }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
