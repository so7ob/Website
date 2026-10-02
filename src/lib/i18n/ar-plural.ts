/**
 * تصريف العدد العربي (التمييز) — §D جولة 34.
 *
 * العربية لا تعرف صيغة جامعة مثل "Used {n} times" الإنجليزية؛ الاسم يُصرَّف حسب العدد:
 *   1 → مفرد (مرة واحدة) · 2 → مثنى (مرتين) · 3–10 → جمع (مرات) · 11+ → مفرد منصوب (مرة)
 *   0 → يُعامل جمعًا (صفر مرات) لكن الواجهة عادة تخفي العدد الصفري أصلًا.
 *
 * الصيغ هنا **عبارات كاملة** مع {n} اختياري — لا أسماء مفردة — حتى تُغطي
 * حالات مثل «استُخدم…» و«{n} عنصرًا» بنفس الدالة دون حقن يدوي لاحقًا.
 */

export interface ArabicCountForms {
  /** العدد 1 — يُفضَّل صياغة بلا {n} («مرة واحدة») */
  one: string;
  /** العدد 2 — مثنى («مرتين») */
  two: string;
  /** 3–10 — جمع مجرور («{n} مرات») */
  few: string;
  /** 11–99 ومئات — مفرد منصوب («{n} مرة») */
  many: string;
}

export function arabicCountPhrase(
  n: number,
  forms: ArabicCountForms,
  /** بديل احتياطي إن لم تُتوفّر صيغ عربية (واجهات إنجليزية) */
  fallback?: string,
): string {
  if (!Number.isFinite(n)) return (fallback ?? forms.many).replace(/\{n\}/g, "0");
  const abs = Math.abs(Math.trunc(n));
  // 0 → جمع مجرور (صفر مرات)؛ 1 مفرد؛ 2 مثنى؛ 3–10 جمع؛ 11+ مفرد منصوب
  const phrase = abs === 1 ? forms.one : abs === 2 ? forms.two : (abs >= 3 && abs <= 10) || abs === 0 ? forms.few : forms.many;
  // الصيغة قد لا تحوي {n} أصلًا (المفرد والمثنى غالبًا) — الاستبدال آمن حينها
  return phrase.replace(/\{n\}/g, String(Math.trunc(n)));
}
