/**
 * الإعدادات المركزية للموقع — عدّل هذا الملف لتحديث بيانات التواصل والروابط
 * دون الحاجة لتعديل أي صفحة. الحقول الفارغة لن تُعرض في الواجهة إطلاقًا.
 */
export const siteConfig = {
  /** الاسم المعروض */
  nameAr: "سُحُب التقنية",
  nameEn: "so7ob",
  taglineAr: "تُمطِرُ حلولًا ذكية.",
  taglineEn: "Raining smart solutions.",

  /**
   * بيانات التواصل الرسمية.
   * ⚠️ لا تُخترع قيمًا هنا: اتركها فارغة حتى تتوفر بيانات معتمدة،
   * وستُعرض تلقائيًا في صفحة التواصل والتذييل عند تعبئتها.
   */
  contact: {
    email: "" as string, // مثال: "hello@so7ob.example" — يُعرض فقط عند تعبئته
    phone: "" as string, // بصيغة دولية مثل: "+9665XXXXXXXX" — يُعرض فقط عند تعبئته
    address: "" as string, // يُعرض فقط عند تعبئته
  },

  /** روابط رسمية */
  github: "https://github.com/so7ob/Website",

  /** نطاق الموقع العام (يُتجاوز بمتغير البيئة NEXT_PUBLIC_SITE_URL) */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
