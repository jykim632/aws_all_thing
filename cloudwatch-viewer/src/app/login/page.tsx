"use client";

/**
 * 로그인 페이지
 */

import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          CloudWatch Logs
        </h1>
        <LoginForm />
        <p className="mt-6 text-xs text-center text-gray-500">
          Sign in with your LDAP credentials
        </p>
        <button
          onClick={() => setShowHelp(true)}
          className="mt-4 w-full py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 border border-gray-300 transition-colors"
        >
          사용방법
        </button>
      </div>

      {/* 사용방법 모달 */}
      {showHelp && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">사용방법</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <section>
                  <h3 className="font-semibold text-gray-800 mb-2">1. 로그인</h3>
                  <p>사내 LDAP 계정 (ID/비밀번호)으로 로그인합니다.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-800 mb-2">2. AWS Credentials 설정</h3>
                  <p className="mb-2">로그인 후 Settings 페이지에서 AWS 자격 증명을 등록합니다.</p>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="font-medium mb-1">발급 방법:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li>AWS Console → IAM → Users → 본인 계정</li>
                      <li>Security credentials → Access keys → Create</li>
                      <li>생성된 키를 Settings에 입력</li>
                    </ol>
                  </div>
                  <p className="mt-2 text-gray-600">
                    <strong>권장 권한:</strong> CloudWatchLogsReadOnlyAccess
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-gray-800 mb-2">3. 로그 조회</h3>
                  <p>메인 페이지에서 Log Group을 선택하고 시간 범위를 지정하여 로그를 조회합니다.</p>
                </section>

                <section className="bg-blue-50 p-3 rounded-md">
                  <h3 className="font-semibold text-blue-800 mb-2">보안 안내</h3>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>AWS Credentials는 AES-256으로 암호화 저장</li>
                    <li>세션은 8시간 후 자동 만료</li>
                    <li>Secret Key는 저장 후 조회 불가 (마스킹)</li>
                  </ul>
                </section>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full py-2 px-4 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
