"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const STEP_INDEX = { request: 0, verify: 1, reset: 2 };

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Prefill email from ?email= query param (e.g. coming from team invite)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("email");
    if (prefill) setEmail(prefill);
  }, []);

  // 30s resend cooldown timer (same as buyer)
  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function requestCode(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send code.");
      setMessage("Verification code sent. Check your email.");
      setStep("verify");
      setResendCooldown(30);
    } catch (err) {
      setError(err.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode(e) {
    e.preventDefault();
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send code.");
      setResendCooldown(30);
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setResendLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code.");
      setStep("reset");
    } catch (err) {
      setError(err.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");
      setMessage("Password reset successfully. Redirecting to login...");
      setTimeout(() => router.push("/login"), 1400);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "block w-full border-[1.5px] border-line rounded-[9px] px-3.5 py-3 bg-white text-[14px] text-body placeholder:text-mist focus:outline-none focus:border-ink focus:shadow-offset-3 transition-all duration-120"
  const btnPrimaryCls = "w-full bg-ink text-white border-[1.5px] border-ink rounded-[10px] px-[22px] py-3 text-[15px] font-semibold shadow-soft-3 hover:bg-smoke-2 disabled:opacity-50 transition-all duration-120 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
  const labelCls = "block text-[13px] font-semibold text-body mb-1.5"

  const stepIdx = STEP_INDEX[step] ?? 0;

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Striped brand backdrop */}
      <div className="absolute inset-0 bg-stripes-backdrop" aria-hidden />
      <div className="absolute inset-0 bg-[rgba(250,250,250,0.55)]" aria-hidden />

      {/* Logo top left – same as login */}
      <Link
        href="/"
        className="absolute top-5 left-4 sm:left-8 z-20 inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Logo size="header" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
      </Link>

      <div className="flex-1 flex items-center justify-center px-4 py-10 pt-24 relative z-10">
        <div className="w-full max-w-[520px]">
          <Link href="/login" className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink underline hover:text-muted mb-5 transition-colors duration-120">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>

          <div className="bg-white border-[1.5px] border-ink rounded-2xl shadow-offset-6 overflow-hidden">
            {/* Card header bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-tint-2 border-b-[1.5px] border-ink">
              <div className="flex items-center gap-2.5">
                <Logo size="header" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Seller Portal</span>
              </div>
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                Step {stepIdx + 1} of 3
              </span>
            </div>

            {/* Segmented progress */}
            <div className="flex gap-1.5 px-6 pt-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-pill border-[1.5px] border-ink ${i <= stepIdx ? "bg-ink" : "bg-white"}`}
                />
              ))}
            </div>

            <div className="p-6 sm:p-7">
              <div className="mb-6">
                <h1 className="font-display font-bold text-[26px] tracking-[-0.025em] text-body mb-1.5">Forgot password</h1>
                <p className="text-sm text-smoke-2">
                  {step === "request" && "Enter your seller email to get a verification code."}
                  {step === "verify" && "Enter the 6-digit code sent to your email."}
                  {step === "reset" && "Set your new password."}
                </p>
              </div>

              {error && (
                <div className="mb-4 text-sm font-semibold text-ink bg-tint border-[1.5px] border-ink rounded-[9px] px-3.5 py-2.5">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 flex items-center gap-2.5 text-sm font-semibold text-ink bg-tint border-[1.5px] border-ink rounded-[9px] px-3.5 py-2.5">
                  <span className="w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center flex-shrink-0" aria-hidden>
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.4 5.8L8 1" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  {message}
                </div>
              )}

              {step === "request" && (
                <form onSubmit={requestCode} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className={labelCls}>Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className={inputCls}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimaryCls}>
                    {loading ? "Sending..." : "Send verification code"}
                  </button>
                </form>
              )}

              {step === "verify" && (
                <form onSubmit={verifyCode} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className={labelCls}>Verification code</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className={`${inputCls} font-mono font-bold text-center tracking-[0.35em] text-xl`}
                      maxLength={6}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading || otp.length !== 6} className={btnPrimaryCls}>
                    {loading ? "Verifying..." : "Verify code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendLoading || resendCooldown > 0}
                    className="w-full text-[13px] font-semibold text-ink underline hover:text-muted disabled:opacity-50 disabled:cursor-not-allowed py-2 transition-colors duration-120"
                  >
                    {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                  </button>
                </form>
              )}

              {step === "reset" && (
                <form onSubmit={resetPassword} className="space-y-4 sm:space-y-5">
                  <div>
                    <label className={labelCls}>New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className={inputCls}
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className={inputCls}
                      minLength={6}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimaryCls}>
                    {loading ? "Resetting..." : "Reset password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
