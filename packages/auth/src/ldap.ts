/**
 * LDAP 인증 클라이언트
 * DEV_SKIP_LDAP=true 설정 시 개발용 mock 인증
 */

import { Client } from "ldapts";
import type { LdapUser } from "./types";

/**
 * LDAP filter value escape (RFC 4515)
 * 특수문자를 hex escape 처리
 */
function escapeLdapFilter(value: string): string {
  return value.replace(/[*()\\\/\0]/g, (char) => {
    return "\\" + char.charCodeAt(0).toString(16).padStart(2, "0");
  });
}

/**
 * LDAP 인증 수행
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
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const baseDn = process.env.LDAP_BASE_DN;
  const userFilter = process.env.LDAP_USER_FILTER;

  if (!ldapUrl || !bindDn || !bindPassword || !baseDn || !userFilter) {
    console.error("LDAP configuration is incomplete");
    return null;
  }

  const client = new Client({
    url: ldapUrl,
    tlsOptions:
      process.env.LDAP_TLS_ENABLED === "true"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    // 1. 서비스 계정으로 바인드
    await client.bind(bindDn, bindPassword);

    // 2. 사용자 검색 (LDAP injection 방지를 위한 escape)
    const escapedUsername = escapeLdapFilter(username);
    const filter = userFilter.replace("{{username}}", escapedUsername);
    const { searchEntries } = await client.search(baseDn, {
      scope: "sub",
      filter,
      attributes: ["uid", "cn", "displayName", "mail"],
    });

    if (searchEntries.length === 0) {
      return null;
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // 3. 서비스 계정 언바인드
    await client.unbind();

    // 4. 사용자 credentials로 바인드 (비밀번호 검증)
    const userClient = new Client({ url: ldapUrl });
    await userClient.bind(userDn, password);
    await userClient.unbind();

    return {
      username,
      displayName: String(
        userEntry.displayName || userEntry.cn || username
      ),
      email: userEntry.mail ? String(userEntry.mail) : undefined,
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
