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
