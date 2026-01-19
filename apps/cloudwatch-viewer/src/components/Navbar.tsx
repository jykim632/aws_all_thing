"use client";

/**
 * 네비게이션 바
 * - 사용자 이름 표시
 * - 설정 링크
 * - 로그아웃 버튼
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@aws-internal/ui";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white border-b">
      <div className="flex items-center justify-between px-4 py-2">
        {/* 왼쪽: 로고 + 네비게이션 */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold text-gray-800 hover:text-gray-600"
          >
            CloudWatch Logs
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className={`text-sm ${
                isActive("/")
                  ? "text-blue-600 font-medium"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Logs
            </Link>
            <Link
              href="/settings"
              className={`text-sm ${
                isActive("/settings")
                  ? "text-blue-600 font-medium"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Settings
            </Link>
          </div>
        </div>

        {/* 오른쪽: 사용자 정보 + 로그아웃 */}
        <div className="flex items-center gap-4">
          {/* Credentials 상태 */}
          {!user?.hasAwsCredentials && (
            <Link
              href="/settings"
              className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded"
            >
              AWS 설정 필요
            </Link>
          )}

          {/* 사용자 이름 */}
          <span className="text-sm text-gray-600">
            {user?.displayName || user?.username}
          </span>

          {/* 로그아웃 버튼 */}
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
