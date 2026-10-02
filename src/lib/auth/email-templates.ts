/**
 * قوالب البريد ثنائية اللغة — نصوص وروابط الرسائل المرسلة من المنصة.
 */

export interface MailLink {
  url: string;
}

export function verifyEmailMail(locale: string, { url }: MailLink) {
  if (locale === "en") {
    return {
      subject: "Verify your email — so7ob",
      text: `Welcome to so7ob!\n\nConfirm your email address to activate your account:\n${url}\n\nThis link expires in 24 hours and can be used only once.\n\nIf you did not create an account, you can safely ignore this email.`,
    };
  }
  return {
    subject: "تأكيد بريدك الإلكتروني — سُحُب التقنية",
    text: `مرحبًا بك في سُحُب التقنية!\n\nأكّد بريدك الإلكتروني لتفعيل حسابك:\n${url}\n\nالرابط صالح 24 ساعة ويعمل لمرة واحدة.\n\nإن لم تُنشئ حسابًا فتجاهل هذه الرسالة بأمان.`,
  };
}

export function resetPasswordMail(locale: string, { url }: MailLink) {
  if (locale === "en") {
    return {
      subject: "Reset your password — so7ob",
      text: `A password reset was requested for your account.\n\nSet a new password via this link:\n${url}\n\nThe link expires in 30 minutes and can be used only once.\n\nIf you did not request this, ignore this email — your password stays unchanged.`,
    };
  }
  return {
    subject: "إعادة تعيين كلمة المرور — سُحُب التقنية",
    text: `طُلب إعادة تعيين كلمة المرور لحسابك.\n\nاضبط كلمة مرور جديدة عبر الرابط:\n${url}\n\nالرابط صالح 30 دقيقة ويعمل لمرة واحدة.\n\nإن لم تطلب ذلك فتجاهل الرسالة — كلمة مرورك لن تتغير.`,
  };
}

export function claimRequestMail(locale: string, { url, refCode }: MailLink & { refCode: string }) {
  if (locale === "en") {
    return {
      subject: `Confirm linking request ${refCode} to your account — so7ob`,
      text: `You asked to link request ${refCode} to your account.\n\nConfirm via this link:\n${url}\n\nThe link expires in 24 hours and can be used only once.`,
    };
  }
  return {
    subject: `تأكيد ربط الطلب ${refCode} بحسابك — سُحُب التقنية`,
    text: `طلبت ربط الطلب ${refCode} بحسابك.\n\nأكّد عبر الرابط:\n${url}\n\nالرابط صالح 24 ساعة ويعمل لمرة واحدة.`,
  };
}

export function newRequestStaffMail(locale: string, { refCode, name }: { refCode: string; name: string }) {
  if (locale === "en") {
    return {
      subject: `New request ${refCode} — so7ob`,
      text: `A new project request arrived.\n\nReference: ${refCode}\nFrom: ${name}\n\nOpen the admin panel to review and respond.`,
    };
  }
  return {
    subject: `طلب جديد ${refCode} — سُحُب التقنية`,
    text: `وصل طلب مشروع جديد.\n\nالرقم المرجعي: ${refCode}\nمن: ${name}\n\nافتح لوحة الإدارة لمراجعته والرد عليه.`,
  };
}

// ————————————————————————————————————————————————————————————————
// روابط المتابعة — تسليم الرابط وإشعار الرد
// ————————————————————————————————————————————————————————————————

/** تسليم رابط المتابعة عند الإصدار/التجديد — الرمز الخام يظهر في البريد فقط ولا يُخزن */
export function trackLinkMail(
  locale: string,
  { url, refCode, expiresInDays }: { url: string; refCode: string; expiresInDays: number }
) {
  if (locale === "en") {
    return {
      subject: `Your follow-up link for ${refCode} — so7ob`,
      text: `Your follow-up link for ${refCode} is ready:\n\n${url}\n\nThe link stays valid for ${expiresInDays} day(s) and can be reused until it expires or is revoked.\n\nKeep this email — the link is your key to view the card and its conversation. If it is ever revoked or expires, contact us to issue a new one after verifying your identity.`,
    };
  }
  return {
    subject: `رابط متابعتك للطلب ${refCode} — سُحُب التقنية`,
    text: `رابط متابعة الطلب ${refCode}:\n\n${url}\n\nالرابط صالح لمدة ${expiresInDays} يومًا ويمكن استخدامه مرارًا حتى انتهاء صلاحيته أو إلغائه.\n\nاحتفظ بهذه الرسالة — الرابط هو مفتاحك للاطلاع على البطاقة ومحادثتها. إن أُلغي أو انتهت صلاحيته فتواصل معنا لإصدار رابط جديد بعد التحقق من هويتك.`,
  };
}

export interface StaffReplyMailInput {
  refCode: string;
  /** رابط آمن لا يُحيي رابطًا ملغى: إما بطاقة الحساب (يتطلب دخول المالك) أو صفحة المتابعة العامة */
  url: string;
  /** مقتطف من نص الرد — اختياري وبلا ملاحظات داخلية أبدًا */
  preview?: string;
}

/** إشعار العميل برد الفريق — يعمل حتى بلا حساب مرتبط (نرسل إلى بريد البطاقة) */
export function staffReplyMail(locale: string, { refCode, url, preview }: StaffReplyMailInput) {
  const previewLine = preview ? `\n\n— مقتطف من الرد —\n${preview}\n` : "";
  const previewLineEn = preview ? `\n\n— Reply preview —\n${preview}\n` : "";
  if (locale === "en") {
    return {
      subject: `New reply on ${refCode} — so7ob`,
      text: `A new reply was added to your card ${refCode}.${previewLineEn}\nOpen your follow-up card:\n${url}\n\nIf your follow-up link was revoked or expired, sign in to your account or contact us to get a new link.`,
    };
  }
  return {
    subject: `رد جديد على ${refCode} — سُحُب التقنية`,
    text: `أُضيف رد جديد على بطاقتك ${refCode}.${previewLine}\nافتح بطاقة المتابعة:\n${url}\n\nإن كان رابط المتابعة ملغى أو منتهي الصلاحية فسجّل الدخول إلى حسابك أو تواصل معنا للحصول على رابط جديد.`,
  };
}
