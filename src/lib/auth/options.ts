/**
 * إعداد NextAuth v4 (المكتبة المثبتة مسبقًا والمتوافقة مع Next 16 — تم التحقق عمليًا).
 *
 * الاستراتيجية: JWT + سجل جلسات AuthSession في قاعدة البيانات:
 * - عند الدخول يصدر رمز JWT بـ iat جديد؛ أول تحقق لاحق (أول 60 ثانية) يُنشئ
 *   سجل الجلسة تلقائيًا ببصمة sha256(userId + ":" + iat).
 * - كل طلب لاحق يتحقق من وجود البصمة وعدم إبطالها ومن حالة المستخدم —
 *   ما يتيح إبطال الجلسات فور إيقاف الحساب أو "تسجيل الخروج من كل الأجهزة".
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sha256 } from "./tokens";

export const SESSION_DAYS = 30;
const BOOTSTRAP_WINDOW_MS = 60_000;

/**
 * سر احتياطي للتطوير المحلي فقط — يُستخدم حين يغيب AUTH_SECRET عن البيئة
 * (بيئة الاختبار أعادت كتابة .env من قالب بلا السر فأبطلت كل الجلسات القائمة).
 * ثابت وموثق ومخصص للتطوير؛ الإنتاج بلا AUTH_SECRET يرفع next-auth خطأ
 * MissingSecret ولا يسقط أبدًا إلى سر معروف.
 */
const DEV_AUTH_SECRET_FALLBACK = "ce1cfd44862e227ec0cd7d7e40d7b0145031bfaa0070fe12ecd36ce1146bcc5d";

/** بصمة الجلسة من محتويات رمز JWT */
export function sessionFingerprint(userId: string, iat: number): string {
  return sha256(`session:${userId}:${iat}`);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "so7ob",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? "").trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        // الموقوفون لا يدخلون — إبطال فعلي للوصول
        if (user.status === "suspended") return null;

        // قفل محاولات الدخول الفاشلة المتكررة (5 خلال نافذة 15 دقيقة)
        const now = Date.now();
        if (user.lockedUntil && user.lockedUntil.getTime() > now) return null;
        const windowStart = (user.lastLoginAt?.getTime() ?? now) - 0; // المرجع: آخر تحديث للعدّاد
        const failRecent = user.failedLoginCount > 0 && now - (user.updatedAt?.getTime() ?? 0) < 15 * 60 * 1000;
        const inWindow = failRecent || user.failedLoginCount === 0;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const count = inWindow ? user.failedLoginCount + 1 : 1;
          const lock = count >= 5 ? new Date(now + 15 * 60 * 1000) : null;
          await db.user.update({
            where: { id: user.id },
            data: { failedLoginCount: count, lockedUntil: lock },
          }).catch(() => {});
          return null;
        }

        if (user.failedLoginCount > 0 || user.lockedUntil) {
          await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }).catch(() => {});
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKey: user.roleKey,
          status: user.status,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  },
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : DEV_AUTH_SECRET_FALLBACK),
  callbacks: {
    async jwt({ token, user }) {
      // عند الدخول: تثبيت بيانات المستخدم في الرمز (iat سيضاف عند التوقيع)
      if (user) {
        const u = user as { id: string; roleKey: string; status: string };
        return { ...token, uid: u.id, role: u.roleKey, status: u.status };
      }

      // الطلبات اللاحقة: تحقق فعلي من الجلسة والحالة
      const uid = token.uid as string | undefined;
      if (!uid) return token;
      const iat = typeof token.iat === "number" ? token.iat : 0;
      if (!iat) return {} as typeof token;
      const fingerprint = sessionFingerprint(uid, iat);

      const [userRow, sessionRow] = await Promise.all([
        db.user.findUnique({
          where: { id: uid },
          select: { status: true, sessionsRevokedAt: true, roleKey: true, name: true },
        }),
        db.authSession.findUnique({ where: { fingerprint }, select: { revokedAt: true, expiresAt: true } }),
      ]);

      // سجل الجلسة غير موجود: أنشئه إن كان الرمز وليدًا (أول تحقق بعد الدخول)
      let session = sessionRow;
      if (!session && Date.now() - iat * 1000 < BOOTSTRAP_WINDOW_MS) {
        session = await db.authSession.upsert({
          where: { fingerprint },
          create: {
            userId: uid,
            fingerprint,
            expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
          },
          update: {},
          select: { revokedAt: true, expiresAt: true },
        }).catch(() => null);
      }

      const revokedByUser = userRow?.sessionsRevokedAt && userRow.sessionsRevokedAt.getTime() > iat * 1000;
      const valid =
        userRow &&
        (userRow.status === "active" || userRow.status === "pending_verification") &&
        session &&
        !session.revokedAt &&
        session.expiresAt.getTime() > Date.now() &&
        !revokedByUser;

      if (!valid) return {} as typeof token; // إبطال فوري

      // مزامنة الدور/الاسم الحاليين من قاعدة البيانات
      token.role = userRow.roleKey;
      token.name = userRow.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as Record<string, unknown>).id = token.uid;
        (session.user as Record<string, unknown>).roleKey = token.role;
        (session.user as Record<string, unknown>).sessionIat = token.iat;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      // إبطال سجل الجلسة عند الخروج — التوافق مع اختلاف أشكال الرسالة بين الإصدارات
      const payload = (message as { token?: { uid?: unknown; iat?: unknown } })?.token ?? (message as { uid?: unknown; iat?: unknown }) ?? {};
      const uid = (payload as { uid?: unknown }).uid as string | undefined;
      const iat = (payload as { iat?: unknown }).iat as number | undefined;
      if (uid && typeof iat === "number") {
        try {
          await db.authSession.update({
            where: { fingerprint: sessionFingerprint(uid, iat) },
            data: { revokedAt: new Date(), revokedReason: "user_logout" },
          });
        } catch {
          // لا سجل — تجاهل
        }
      }
    },
  },
  logger: {
    error(code, metadata) {
      // كوكي جلسة غير قابل لفك التشفير (سر سابق أو كوكي تالف): حالة زائر لا خطأ خادم —
      // تحذير موجز بدل خطأ وحدة تحكم يظهر في لوحة Next.js كخطأ صفحة (next-auth يعاملها كمُسجَّل خروج)
      if (code === "JWT_SESSION_ERROR") {
        console.warn(
          `[next-auth:${code}] ${metadata instanceof Error ? metadata.message : "session cookie unreadable"} — treated as signed out`
        );
        return;
      }
      console.error(`[next-auth:${code}]`, metadata);
    },
    warn() {},
    info() {},
  },
};
