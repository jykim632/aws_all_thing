"use client";

/**
 * 네비게이션 바
 * - 앱 이름, 네비게이션 항목 props로 받음
 * - 사용자 이름 표시
 * - 로그아웃 버튼
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthGuard";
import type { NavbarProps } from "./types";

export function Navbar({ appName, navItems, statusBadge }: NavbarProps) {
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
            {appName}
          </Link>

          <div className="flex items-center gap-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-sm ${
                  isActive(item.path)
                    ? "text-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 오른쪽: 사용자 정보 + 로그아웃 */}
        <div className="flex items-center gap-4">
          {/* 상태 배지 (옵션) */}
          {statusBadge?.show && (
            <Link
              href={statusBadge.href}
              className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded"
            >
              {statusBadge.label}
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
