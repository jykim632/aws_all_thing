/**
 * 로그인 페이지
 */

import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
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
      </div>
    </div>
  );
}
