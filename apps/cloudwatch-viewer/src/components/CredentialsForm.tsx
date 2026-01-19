"use client";

/**
 * AWS Credentials 설정 폼
 */

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@aws-internal/ui";

import type { CredentialsResponse } from "@/types";

type CredentialsInfo = CredentialsResponse;

export function CredentialsForm() {
  const { refetch } = useAuth();
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("ap-northeast-2");
  const [useMfa, setUseMfa] = useState(false);
  const [mfaSerial, setMfaSerial] = useState("");
  const [existingCreds, setExistingCreds] = useState<CredentialsInfo | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 기존 credentials 조회
  useEffect(() => {
    async function fetchCredentials() {
      try {
        const res = await fetch("/api/credentials");
        const data: CredentialsInfo = await res.json();
        setExistingCreds(data);
        if (data.region) {
          setRegion(data.region);
        }
        if (data.mfaEnabled) {
          setUseMfa(true);
        }
      } catch {
        setExistingCreds({
          hasCredentials: false,
          accessKeyIdMasked: null,
          region: "ap-northeast-2",
          mfaEnabled: false,
          mfaSerialMasked: null,
          tempCredentialsStatus: "none",
          tempExpiresAt: null,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchCredentials();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKeyId,
          secretAccessKey,
          region,
          mfaSerial: useMfa ? mfaSerial : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save credentials");
      }

      setMessage({ type: "success", text: "Credentials saved successfully" });
      setAccessKeyId("");
      setSecretAccessKey("");
      setMfaSerial("");

      // 기존 credentials 다시 조회
      const credsRes = await fetch("/api/credentials");
      const credsData = await credsRes.json();
      setExistingCreds(credsData);

      // 사용자 정보 갱신
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save credentials",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete your AWS credentials?")) {
      return;
    }

    setMessage(null);
    setSaving(true);

    try {
      const res = await fetch("/api/credentials", { method: "DELETE" });

      if (!res.ok) {
        throw new Error("Failed to delete credentials");
      }

      setMessage({ type: "success", text: "Credentials deleted" });
      setExistingCreds({
        hasCredentials: false,
        accessKeyIdMasked: null,
        region: "ap-northeast-2",
        mfaEnabled: false,
        mfaSerialMasked: null,
        tempCredentialsStatus: "none",
        tempExpiresAt: null,
      });
      setUseMfa(false);
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to delete credentials",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 도움말 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          AWS Credentials 발급 방법
        </h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>AWS Console → IAM → Users → 본인 계정 선택</li>
          <li>Security credentials 탭 → Access keys → Create access key</li>
          <li>Use case: Application running outside AWS 선택</li>
          <li>생성된 Access Key ID와 Secret Access Key를 아래에 입력</li>
        </ol>
        <p className="text-sm text-blue-700 mt-2">
          <strong>권장 권한:</strong> CloudWatchLogsReadOnlyAccess (읽기 전용)
        </p>
      </div>

      {/* 보안 안내 */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-800 mb-2">
          보안 안내
        </h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Credentials는 AES-256-GCM으로 암호화되어 서버에 저장됩니다</li>
          <li>세션은 HttpOnly 쿠키로 관리되어 XSS 공격으로부터 보호됩니다</li>
          <li>Secret Access Key는 저장 후 다시 조회할 수 없습니다 (마스킹 처리)</li>
          <li>더 이상 사용하지 않으면 Delete 버튼으로 삭제해주세요</li>
        </ul>
      </div>

      {/* 현재 상태 */}
      {existingCreds?.hasCredentials && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-800 font-medium">
                AWS Credentials Configured
              </p>
              <p className="text-sm text-green-600 mt-1 font-mono">
                Access Key: {existingCreds.accessKeyIdMasked}
              </p>
              <p className="text-sm text-green-600 font-mono">
                Region: {existingCreds.region}
              </p>
              {existingCreds.mfaEnabled && (
                <>
                  <p className="text-sm text-green-600 font-mono">
                    MFA: {existingCreds.mfaSerialMasked}
                  </p>
                  <p className="text-sm text-green-600">
                    MFA Session:{" "}
                    {existingCreds.tempCredentialsStatus === "valid" ? (
                      <span className="text-green-700 font-medium">
                        Valid until{" "}
                        {existingCreds.tempExpiresAt
                          ? new Date(existingCreds.tempExpiresAt).toLocaleString()
                          : "N/A"}
                      </span>
                    ) : existingCreds.tempCredentialsStatus === "expired" ? (
                      <span className="text-amber-600 font-medium">Expired</span>
                    ) : (
                      <span className="text-amber-600 font-medium">
                        Not authenticated
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* 메시지 */}
      {message && (
        <div
          className={`p-3 text-sm rounded ${
            message.type === "success"
              ? "text-green-600 bg-green-50 border border-green-200"
              : "text-red-600 bg-red-50 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="accessKeyId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            AWS Access Key ID
          </label>
          <input
            id="accessKeyId"
            type="text"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            placeholder="AKIAIOSFODNN7EXAMPLE"
            required
          />
        </div>

        <div>
          <label
            htmlFor="secretAccessKey"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            AWS Secret Access Key
          </label>
          <input
            id="secretAccessKey"
            type="password"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            placeholder="••••••••••••••••••••"
            required
          />
        </div>

        <div>
          <label
            htmlFor="region"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            AWS Region
          </label>
          <select
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
            <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
            <option value="us-east-1">US East (N. Virginia)</option>
            <option value="us-west-2">US West (Oregon)</option>
            <option value="eu-west-1">Europe (Ireland)</option>
          </select>
        </div>

        {/* MFA 설정 */}
        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useMfa}
              onChange={(e) => setUseMfa(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              MFA 사용 (선택)
            </span>
          </label>

          {useMfa && (
            <div className="mt-3">
              <label
                htmlFor="mfaSerial"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                MFA Device ARN
              </label>
              <input
                id="mfaSerial"
                type="text"
                value={mfaSerial}
                onChange={(e) => setMfaSerial(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="arn:aws:iam::123456789012:mfa/username"
              />
              <p className="mt-1 text-xs text-gray-500">
                AWS Console → IAM → Users → Security credentials → MFA devices에서
                ARN 복사
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? "Saving..."
            : existingCreds?.hasCredentials
            ? "Update Credentials"
            : "Save Credentials"}
        </button>
      </form>
    </div>
  );
}
