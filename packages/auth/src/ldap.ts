/**
 * LDAP 인증 클라이언트 (Direct Bind 방식)
 * 서비스 계정 없이 사용자 DN 패턴으로 직접 인증
 * DEV_SKIP_LDAP=true 설정 시 개발용 mock 인증
 */

import { Client } from "ldapts";
import type { LdapUser } from "./types";

/**
 * LDAP 인증 수행 (Direct Bind)
 * @returns 성공 시 사용자 정보, 실패 시 null
 */
export async function authenticateWithLdap(
  username: string,
  password: string
): Promise<LdapUser | null> {
  // 개발 모드: LDAP 스킵 (프로덕션에서는 무시)
  const isDevMode = process.env.NODE_ENV === "development";
  if (process.env.DEV_SKIP_LDAP === "true" && isDevMode) {
    if (!password) {
      return null;
    }

    const mockUser = process.env.DEV_MOCK_USER || "testuser";
    if (username === mockUser || username === "testuser") {
      return {
        username,
        displayName: `Dev User (${username})`,
        email: `${username}@dev.local`,
      };
    }

    return {
      username,
      displayName: username,
    };
  }

  // LDAP 설정 확인
  const ldapUrl = process.env.LDAP_URL;
  const userDnPattern = process.env.LDAP_USER_DN_PATTERN;

  if (!ldapUrl || !userDnPattern) {
    console.error("LDAP configuration is incomplete. Required: LDAP_URL, LDAP_USER_DN_PATTERN");
    return null;
  }

  // 사용자 DN 생성
  const userDn = userDnPattern.replace("{{username}}", username);

  const client = new Client({
    url: ldapUrl,
    tlsOptions:
      process.env.LDAP_TLS_ENABLED === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    // 사용자 DN + 비밀번호로 직접 바인드
    await client.bind(userDn, password);
    await client.unbind();

    return {
      username,
      displayName: username,
    };
  } catch (error) {
    console.error("LDAP authentication failed:", error);
    return null;
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}
