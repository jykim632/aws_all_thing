"use client";

/**
 * AWS Credentials 설정 폼
 * - 자격증명 없으면: 전체 폼 표시
 * - 자격증명 있으면: 요약 뷰 + 필드별 편집
 */

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@aws-internal/ui";

import type { CredentialsResponse } from "@/types";

type CredentialsInfo = CredentialsResponse;
type EditingField = "none" | "keys" | "region" | "mfa";

const REGIONS = [
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
];

export function CredentialsForm() {
  const { refetch } = useAuth();

  // 폼 입력 상태
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [region, setRegion] = useState("ap-northeast-2");
  const [mfaSerial, setMfaSerial] = useState("");

  // UI 상태
  const [existingCreds, setExistingCreds] = useState<CredentialsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>("none");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 기존 credentials 조회
  useEffect(() => {
    fetchCredentials();
  }, []);

  async function fetchCredentials() {
    try {
      const res = await fetch("/api/credentials");
      const data: CredentialsInfo = await res.json();
      setExistingCreds(data);
      if (data.region) {
        setRegion(data.region);
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

  // 전체 저장 (POST) - 신규 생성용
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
          mfaSerial: mfaSerial || undefined,
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

      await fetchCredentials();
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

  // 부분 업데이트 (PATCH)
  const handlePatch = async (patchData: Record<string, unknown>) => {
    setMessage(null);
    setSaving(true);

    try {
      const res = await fetch("/api/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update credentials");
      }

      setMessage({ type: "success", text: "Updated successfully" });
      setEditingField("none");
      setAccessKeyId("");
      setSecretAccessKey("");
      setMfaSerial("");

      await fetchCredentials();
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update credentials",
      });
    } finally {
      setSaving(false);
    }
  };

  // 삭제
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
      setEditingField("none");
      refetch();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to delete credentials",
      });
    } finally {
      setSaving(false);
    }
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingField("none");
    setAccessKeyId("");
    setSecretAccessKey("");
    setMfaSerial("");
    if (existingCreds?.region) {
      setRegion(existingCreds.region);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  const hasCredentials = existingCreds?.hasCredentials;

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
        <h3 className="text-sm font-medium text-gray-800 mb-2">보안 안내</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Credentials는 AES-256-GCM으로 암호화되어 서버에 저장됩니다</li>
          <li>세션은 HttpOnly 쿠키로 관리되어 XSS 공격으로부터 보호됩니다</li>
          <li>Secret Access Key는 저장 후 다시 조회할 수 없습니다 (마스킹 처리)</li>
          <li>더 이상 사용하지 않으면 Delete 버튼으로 삭제해주세요</li>
        </ul>
      </div>

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

      {/* 자격증명 있을 때: 요약 뷰 + 필드별 편집 */}
      {hasCredentials ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-800 font-medium">
              AWS Credentials Configured
            </p>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Delete All
            </button>
          </div>

          {/* Access Key 필드 */}
          <div className="border-t border-green-200 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-green-700">Access Key: </span>
                <span className="text-sm text-green-600 font-mono">
                  {existingCreds.accessKeyIdMasked}
                </span>
              </div>
              {editingField !== "keys" && (
                <button
                  onClick={() => setEditingField("keys")}
                  disabled={saving || editingField !== "none"}
                  className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  변경
                </button>
              )}
            </div>

            {editingField === "keys" && (
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Access Key ID
                  </label>
                  <input
                    type="text"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={secretAccessKey}
                    onChange={(e) => setSecretAccessKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="••••••••••••••••••••"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() =>
                      handlePatch({ accessKeyId, secretAccessKey })
                    }
                    disabled={saving || !accessKeyId || !secretAccessKey}
                    className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Region 필드 */}
          <div className="border-t border-green-200 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-green-700">Region: </span>
                <span className="text-sm text-green-600 font-mono">
                  {existingCreds.region}
                </span>
              </div>
              {editingField !== "region" && (
                <button
                  onClick={() => setEditingField("region")}
                  disabled={saving || editingField !== "none"}
                  className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  변경
                </button>
              )}
            </div>

            {editingField === "region" && (
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REGIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handlePatch({ region })}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MFA 필드 */}
          <div className="border-t border-green-200 pt-3">
            <div className="flex items-start justify-between">
              <div>
                <div>
                  <span className="text-sm text-green-700">MFA: </span>
                  {existingCreds.mfaEnabled ? (
                    <span className="text-sm text-green-600 font-mono">
                      {existingCreds.mfaSerialMasked}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">미설정</span>
                  )}
                </div>
                {existingCreds.mfaEnabled && (
                  <div className="mt-1">
                    <span className="text-sm text-green-700">Session: </span>
                    {existingCreds.tempCredentialsStatus === "valid" ? (
                      <span className="text-sm text-green-700 font-medium">
                        Valid until{" "}
                        {existingCreds.tempExpiresAt
                          ? new Date(existingCreds.tempExpiresAt).toLocaleString()
                          : "N/A"}
                      </span>
                    ) : existingCreds.tempCredentialsStatus === "expired" ? (
                      <span className="text-sm text-amber-600 font-medium">
                        Expired
                      </span>
                    ) : (
                      <span className="text-sm text-amber-600 font-medium">
                        Not authenticated
                      </span>
                    )}
                  </div>
                )}
              </div>
              {editingField !== "mfa" && (
                <button
                  onClick={() => setEditingField("mfa")}
                  disabled={saving || editingField !== "none"}
                  className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
                >
                  {existingCreds.mfaEnabled ? "변경" : "설정"}
                </button>
              )}
            </div>

            {editingField === "mfa" && (
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MFA Device ARN
                  </label>
                  <input
                    type="text"
                    value={mfaSerial}
                    onChange={(e) => setMfaSerial(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="arn:aws:iam::123456789012:mfa/username"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    비워두면 MFA가 삭제됩니다
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={() =>
                      handlePatch({ mfaSerial: mfaSerial || null })
                    }
                    disabled={saving}
                    className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 자격증명 없을 때: 전체 폼 */
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
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* MFA 설정 */}
          <div className="border-t border-gray-200 pt-4">
            <div>
              <label
                htmlFor="mfaSerial"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                MFA Device ARN (선택)
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
                AWS Console → IAM → Users → Security credentials → MFA
                devices에서 ARN 복사
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Credentials"}
          </button>
        </form>
      )}
    </div>
  );
}
