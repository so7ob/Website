/** بطاقة المصادقة المشتركة — هوية بصرية موحدة لكل صفحات الدخول والحساب */
export function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  /** شارة أيقونة اختيارية بجوار العنوان — نمط رؤوس الصفحات (chip + كتلة عنوان) */
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const heading = (
    <>
      <h1 className="text-xl font-bold text-navy sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-7 text-muted-foreground">{subtitle}</p>}
    </>
  );
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      {icon ? (
        <div className="flex items-center gap-3">
          {icon}
          <div className="min-w-0">{heading}</div>
        </div>
      ) : (
        heading
      )}
      {children}
      {footer && <div className="mt-6 border-t border-border pt-5 text-sm">{footer}</div>}
    </section>
  );
}
