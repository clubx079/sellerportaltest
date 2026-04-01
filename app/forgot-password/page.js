"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, MapPin } from "lucide-react";

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
  const [logoError, setLogoError] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* Logo top left – same as login */}
      <Link
        href="/"
        className="absolute top-6 left-6 sm:left-8 z-20 flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <div className="h-9 w-[120px] flex items-center justify-center shrink-0">
          {!logoError ? (
            <Image
              src="/assets/logo.svg"
              alt="DeelMap"
              width={120}
              height={36}
              className="h-9 w-auto object-contain"
              priority
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
        <span className="text-xl font-bold text-slate-900 uppercase tracking-wide -translate-y-0.5">Seller</span>
      </Link>

      <div className="flex-1 flex items-center justify-center px-4 py-10 pt-24">
        <div className="w-full max-w-md">
          <Link href="/login" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>

          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-slate-700" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">Forgot Password</h1>
              <p className="text-sm text-slate-600 mt-1">
                {step === "request" && "Enter your seller email to get a verification code."}
                {step === "verify" && "Enter the 6-digit code sent to your email."}
                {step === "reset" && "Set your new password."}
              </p>
            </div>

            {error && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
            {message && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{message}</div>}

            {step === "request" && (
              <form onSubmit={requestCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-700 disabled:opacity-60">
                  {loading ? "Sending..." : "Send verification code"}
                </button>
              </form>
            )}

            {step === "verify" && (
              <form onSubmit={verifyCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Verification code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-center tracking-[0.35em] text-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    maxLength={6}
                    required
                  />
                </div>
                <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-700 disabled:opacity-60">
                  {loading ? "Verifying..." : "Verify code"}
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendLoading || resendCooldown > 0}
                  className="w-full text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed py-2"
                >
                  {resendLoading ? "Sending..." : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
                </button>
              </form>
            )}

            {step === "reset" && (
              <form onSubmit={resetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
                    minLength={6}
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary-700 disabled:opacity-60">
                  {loading ? "Resetting..." : "Reset password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
