"use client";

/**
 * 설정 페이지
 * AWS Credentials 관리
 */

import { CredentialsForm } from "@/components/CredentialsForm";
import { Navbar } from "@/components/Navbar";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold text-gray-800 mb-6">
            AWS Credentials
          </h1>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              CloudWatch Logs에 접근하려면 AWS Access Key가 필요합니다.
              <br />
              필요한 권한:{" "}
              <code className="text-xs bg-blue-100 px-1 rounded">
                logs:DescribeLogGroups
              </code>
              ,{" "}
              <code className="text-xs bg-blue-100 px-1 rounded">
                logs:FilterLogEvents
              </code>
            </p>
          </div>

          <CredentialsForm />
        </div>
      </main>
    </div>
  );
}
