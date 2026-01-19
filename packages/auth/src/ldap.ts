/**
 * LDAP 인증 클라이언트 (Search and Bind 방식)
 * DEV_SKIP_LDAP=true 설정 시 개발용 mock 인증
 */

import { Client } from "ldapts";
import type { LdapUser } from "./types";

/**
 * LDAP filter value escape (RFC 4515)
 */
function escapeLdapFilter(value: string): string {
  return value.replace(/[*()\\\/\0]/g, (char) => {
    return "\\" + char.charCodeAt(0).toString(16).padStart(2, "0");
  });
}

/**
 * LDAP 인증 수행 (Search and Bind)
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
  const bindDn = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const baseDn = process.env.LDAP_BASE_DN;
  const userFilter = process.env.LDAP_USER_FILTER || "(cn={{username}})";

  if (!ldapUrl || !bindDn || !bindPassword || !baseDn) {
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

    // 2. 사용자 검색
    const escapedUsername = escapeLdapFilter(username);
    const filter = userFilter.replace("{{username}}", escapedUsername);
    const { searchEntries } = await client.search(baseDn, {
      scope: "sub",
      filter,
      attributes: ["cn", "uid", "displayName", "mail"],
    });

    if (searchEntries.length === 0) {
      console.error("User not found in LDAP");
      return null;
    }

    const userEntry = searchEntries[0];
    const userDn = userEntry.dn;

    // 3. 서비스 계정 언바인드
    await client.unbind();

    // 4. 사용자 비밀번호로 바인드 (검증)
    const userClient = new Client({
      url: ldapUrl,
      tlsOptions:
        process.env.LDAP_TLS_ENABLED === "true"
          ? { rejectUnauthorized: false }
          : undefined,
    });
    await userClient.bind(userDn, password);
    await userClient.unbind();

    return {
      username,
      displayName: String(userEntry.displayName || userEntry.cn || username),
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
