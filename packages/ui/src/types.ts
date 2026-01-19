/**
 * UI 관련 타입
 */

import type { ReactNode } from "react";

// ===== AuthGuard =====

export interface UserInfo {
  id: number;
  username: string;
  displayName?: string;
  hasAwsCredentials: boolean;
}

export interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface AuthGuardProps {
  children: ReactNode;
}

// ===== Navbar =====

export interface NavItem {
  path: string;
  label: string;
}

export interface NavbarProps {
  appName: string;
  navItems: NavItem[];
  settingsPath?: string;
  statusBadge?: {
    show: boolean;
    label: string;
    href: string;
  };
}
