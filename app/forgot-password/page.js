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

  const inputCls = "block w-full min-h-[44px] sm:h-12 px-4 rounded border border-[#D4D4CF] bg-white text-[#1A1816] placeholder:text-[#A8A8A4] text-base focus:outline-none focus:ring-2 focus:ring-[#D03839]/20 focus:border-[#D03839] transition-colors"
  const btnPrimaryCls = "w-full min-h-[44px] sm:h-12 rounded bg-[#D03839] hover:bg-[#E0493B] text-white text-sm font-semibold disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#D03839] focus:ring-offset-2"
  const labelCls = "block text-sm font-medium text-[#444441] mb-1.5 sm:mb-2"

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col relative">
      {/* Logo top left – same as login */}
      <Link
        href="/"
        className="absolute top-6 left-6 sm:left-8 z-20 flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <div className="h-14 w-[160px] flex items-center justify-center shrink-0">
          {!logoError ? (
            <Image
              src="/assets/logo.svg"
              alt="DeelMap"
              width={160}
              height={56}
              className="h-14 w-auto object-contain"
              priority
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-10 h-10 rounded bg-[#1A1816] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 flex items-center justify-center px-4 py-10 pt-24">
        <div className="w-full max-w-md">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[#444441] hover:text-[#1A1816] mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>

          <div className="bg-white border-2 border-[#E8E8E4] rounded p-6 sm:p-8 shadow-lg">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded bg-[#F3F3F1] border border-[#E8E8E4] flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5 text-[#444441]" />
              </div>
              <h1 className="text-2xl font-bold text-[#1A1816]">Forgot Password</h1>
              <p className="text-sm text-[#737370] mt-1">
                {step === "request" && "Enter your seller email to get a verification code."}
                {step === "verify" && "Enter the 6-digit code sent to your email."}
                {step === "reset" && "Set your new password."}
              </p>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2.5">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 text-sm text-[#0F6E56] bg-[#E4F5EC] border border-[#9FDBB8] rounded px-3 py-2.5">
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
                    className={`${inputCls} text-center tracking-[0.35em] text-xl`}
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
                  className="w-full text-sm font-medium text-[#444441] hover:text-[#1A1816] disabled:opacity-50 disabled:cursor-not-allowed py-2 transition-colors"
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
  );
}
