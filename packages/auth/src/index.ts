/**
 * @aws-internal/auth
 * LDAP 인증 + iron-session 설정
 */

export { authenticateWithLdap } from "./ldap";
export { createSessionOptions, defaultSession } from "./session";
export type {
  SessionConfig,
  SessionData,
  LdapUser,
  LoginRequest,
  UserInfo,
} from "./types";
export {
  SessionDataSchema,
  LoginRequestSchema,
  UserInfoSchema,
} from "./types";
