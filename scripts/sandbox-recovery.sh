#!/usr/bin/env bash
# استعادة شاملة بعد تصفير بيئة الـ sandbox — بأمر واحد
# الاستخدام: bun run scripts/sandbox-recovery.sh
#
# تسلسل الاستعادة:
# 1) إعادة بناء .env (المفاتيح الأربعة) — المفتاح يُستخرج من ثابت الكود DEV_AUTH_SECRET_FALLBACK (مصدر وحيد)
# 2) إن وُجدت لقطة خارجية سليمة (db-snapshots/latest) والقاعدة فارغة → استعادة منها (أغنى حالة: قوالب/وسائط/إعدادات)
# 3) وإلا → بذر جديد (db:seed) + إعادة حسابات العرض الثلاثة
# 4) تحقق نهائي: عدد الصفحات والمستخدمين
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
ENV_FILE="$ROOT/.env"
SECRET_LINE=$(rg -o 'DEV_AUTH_SECRET_FALLBACK = "([a-f0-9]{64})"' -r '$1' src/lib/auth/options.ts | head -1)
[ -n "$SECRET_LINE" ] || { echo "✗ لم أجد DEV_AUTH_SECRET_FALLBACK في الكود"; exit 1; }

echo "— 1/4 كتابة .env (4 مفاتيح) —"
cat > "$ENV_FILE" << EOF
DATABASE_URL=file:$ROOT/db/custom.db
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=$SECRET_LINE
EMAIL_DEV_MODE=true
EOF
echo "  ✓ .env ($(rg -c '=' "$ENV_FILE") مفاتيح)"

# هل القاعدة فارغة؟
EMPTY=$(bun -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.page.count().then(c => { console.log(c === 0 ? 'yes' : 'no'); return db.\$disconnect(); }).catch(() => { console.log('err'); });
" 2>/dev/null | tail -1)

SNAPSHOT="$ROOT/db-snapshots/latest/database.db"

if [ "$EMPTY" = "yes" ] && [ -f "$SNAPSHOT" ]; then
  echo "— 2/4 القاعدة فارغة + لقطة خارجية موجودة → استعادة من اللقطة —"
  pkill -f 'next dev' 2>/dev/null || true; sleep 1
  BACKUP_WRITES_PAUSED=true bun run scripts/restore-backup.ts "$ROOT/db-snapshots/latest" "$ROOT/db" || true
  # إن فشلت الاستعادة من اللقطة نكمل بالبذر
  EMPTY=$(bun -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.page.count().then(c => { console.log(c === 0 ? 'yes' : 'no'); return db.\$disconnect(); }).catch(() => { console.log('yes'); });
" 2>/dev/null | tail -1)
fi

if [ "$EMPTY" = "yes" ]; then
  echo "— 2/4 بذر قاعدة جديدة —"
  bun run db:seed
else
  echo "— 2/4 القاعدة تحتوي بيانات — تجاوز البذر —"
fi

echo "— 3/4 حسابات العرض الثلاثة —"
bun run scripts/restore-demo-users.ts --reset-passwords

echo "— 4/4 تحقق نهائي —"
bun -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const pages = await db.page.count();
  const users = await db.user.count();
  const home = await db.page.findFirst({ where: { slug: '' }, select: { status: true } });
  console.log('  pages:', pages, '| users:', users, '| homepage:', home ? home.status : 'MISSING');
  await db.\$disconnect();
})();
" 2>/dev/null

echo ""
echo "✓ اكتملت الاستعادة. أعد تشغيل الخادم: (nohup bun run dev > dev.log 2>&1 &)"
echo "  ولقطة جديدة مستقبلاً: pkill -f 'next dev'; BACKUP_WRITES_PAUSED=true bun run db:backup; cp -r db/backups/<الأحدث> db-snapshots/latest"
