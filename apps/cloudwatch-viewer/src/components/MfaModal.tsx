"use client";

/**
 * MFA OTP 입력 모달
 */

import { useState, useRef, useEffect, type FormEvent } from "react";

interface MfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MfaModal({ isOpen, onClose, onSuccess }: MfaModalProps) {
  const [tokenCode, setTokenCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 모달 열릴 때 input focus
  useEffect(() => {
    if (isOpen) {
      setTokenCode("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(tokenCode)) {
      setError("6자리 숫자를 입력하세요.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/credentials/mfa-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "MFA 인증에 실패했습니다.");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "MFA 인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 숫자만 입력 허용
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setTokenCode(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">MFA 인증 필요</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            AWS MFA 앱(Google Authenticator 등)에서 6자리 코드를 확인하세요.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={tokenCode}
              onChange={handleInputChange}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="000000"
              disabled={loading}
            />

            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}

            <p className="mt-3 text-xs text-gray-500 text-center">
              인증 후 12시간 동안 유효합니다.
            </p>

            {/* Actions */}
            <div className="mt-4 flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || tokenCode.length !== 6}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "인증 중..." : "인증"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
