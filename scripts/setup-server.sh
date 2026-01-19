#!/bin/bash
# 서버 초기 설정 스크립트 (1회 실행)
set -e

INSTALL_DIR="/opt/aws-internal"

echo "=== Setting up $INSTALL_DIR ==="

sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# 환경변수 파일 템플릿
cat > .env << 'EOF'
# 버전 (CI에서 자동 설정)
TAG=latest

# Session (32자 이상 필수)
SESSION_SECRET=

# 암호화 Salt (프로덕션 권장, 빈 값이면 기본값 사용)
ENCRYPTION_SALT=

# LDAP 인증 (Direct Bind 방식)
LDAP_URL=ldap://ldap.company.com:389
LDAP_USER_DN_PATTERN=uid={{username}},ou=users,dc=company,dc=com
LDAP_TLS_ENABLED=false
EOF

echo ""
echo "=== Setup complete ==="
echo "환경변수 파일을 수정하세요: $INSTALL_DIR/.env"
echo ""
echo "필수 설정:"
echo "  - SESSION_SECRET (32자 이상 랜덤 문자열)"
echo "  - LDAP_USER_DN_PATTERN (사용자 DN 패턴)"
echo ""
echo "SESSION_SECRET 생성 예시:"
echo "  openssl rand -base64 32"
