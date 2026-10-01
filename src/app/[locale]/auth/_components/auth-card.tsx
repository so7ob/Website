/** بطاقة المصادقة المشتركة — هوية بصرية موحدة لكل صفحات الدخول والحساب */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-xl font-bold text-navy sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-7 text-muted-foreground">{subtitle}</p>}
      {children}
      {footer && <div className="mt-6 border-t border-border pt-5 text-sm">{footer}</div>}
    </section>
  );
}
