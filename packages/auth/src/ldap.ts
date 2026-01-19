/**
 * LDAP 인증 클라이언트 (Direct Bind 방식)
 * DEV_SKIP_LDAP=true 설정 시 개발용 mock 인증
 */

import { Client } from "ldapts";
import type { LdapUser } from "./types";

/**
 * LDAP 인증 수행 (Direct Bind)
 * 서비스 계정 없이 사용자 DN 패턴으로 직접 바인드
 *
 * @returns 성공 시 사용자 정보, 실패 시 null
 */
export async function authenticateWithLdap(
  username: string,
  password: string
): Promise<LdapUser | null> {
  // 개발 모드: LDAP 스킵 (프로덕션에서는 무시)
  const isDevMode = process.env.NODE_ENV === "development";
  if (process.env.DEV_SKIP_LDAP === "true" && isDevMode) {
    // 빈 비밀번호는 거부
    if (!password) {
      return null;
    }

    // mock 사용자 또는 testuser 허용
    const mockUser = process.env.DEV_MOCK_USER || "testuser";
    if (username === mockUser || username === "testuser") {
      return {
        username,
        displayName: `Dev User (${username})`,
        email: `${username}@dev.local`,
      };
    }

    // 개발 모드에서는 아무 사용자나 허용 (password만 있으면)
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

  // 사용자 DN 생성 (패턴에서 {{username}} 치환)
  const userDn = userDnPattern.replace("{{username}}", username);

  const client = new Client({
    url: ldapUrl,
    tlsOptions:
      process.env.LDAP_TLS_ENABLED === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    // Direct bind: 사용자 DN + 비밀번호로 직접 바인드
    await client.bind(userDn, password);
    await client.unbind();

    return {
      username,
      displayName: username, // Direct bind에서는 추가 정보 조회 없음
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
