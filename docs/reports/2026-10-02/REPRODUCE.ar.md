# أدلة الفحص وإعادة قياس سُحُب التقنية

هذه تعليمات إعادة القياس في **نسخة منفصلة ببيانات مصطنعة**، وليست أوامر ترقية أو نشر. تنفيذها على بيانات قائمة غير داخل نطاق التقرير. [التقرير](REPORT.ar.md) يشرح النتائج والحدود؛ [manifest](evidence/manifest.json) يحفظ SHA وبيئة الفحص وبصمات المرفقات.

## ما حُفظ

| الملفات | المحتوى |
|---|---|
| technology-inventory.csv، evidence/inventory.json | النطاق في package.json، إصدار القفل/التثبيت، التراخيص وengines/peers/imports |
| evidence/api-routes.json | جرد معالجات HTTP المصدرة من ملفات API |
| registry-verified.json وtarget-prisma.json | تحقق إصدارات الهدف في سجل npm بتاريخ الفحص؛ ليس اختبار توافق تشغيل |
| lint/typecheck/test/test-node24/build.{json,log} | أوامر الفحص وexit code والزمن والسجلات؛ فشل Node20 محفوظ |
| migrate/seed/migrate-retry/seed-retry.{json,log} | المحاولات الأولى والناجحة على DB جديدة فقط |
| frozen-install.{json,log} | مطابقة القفل في النسخة مع ignore-scripts؛ لا يعوض fresh postinstall |
| api-audit.json وmore-results.json وdashboard-access.json | statuses وbooleans للسيناريوهات الأمنية؛ لا رموز raw أو response bodies خاصة |
| probe-results.json | استهلاك الرمز المتزامن، فحص block types الموروثة، إصدار SQLite وعدد الجداول |
| backup-probe.json وbackup-default-path.json | integrity/FK وفرق raw WAL copy/online backup وفشل المسار الافتراضي |
| browser-audit.json وbrowser-home-normal.json وmotion-probe.json |20 زيارة أساسية و4 normal-home، ResourceTiming/LCP/CLS/axe/overflow، opacity المقدمة |
| bench-results.json | GET100samples لكلconcurrency، writes30samples، warmups10، p50/p95/full-body size |
| query-results.json | SQL placeholders فقط مع duration/count؛ trace مؤقت في نسخة artifact منفصلة، يشمل auth والـtransactions |
| dependency-advisories.json والملخص | bun audit records كما تحققت؛ لا دمجها تلقائيًا مع خطر قابل للاستغلال |
| screenshots/ |11 لقطة مصطنعة مختارة للّغتين والاتجاهين والمقاسات والحركة؛ لا بيانات حقيقية |
| reproduction-sources/*.txt | مصادر أدوات الفحص كما شُغلت، محفوظة نصًا للمراجعة؛ لا تدخل build أو CI للمشروع |

لم تُنسخ `.env` أو `.audit-secrets.json` أو DB أو WAL أو uploads أو raw server/trace logs إلى التقرير. script fixtures يولد كلمة مرور محلية عشوائية ولا يطبعها. query results لا تحتوي parameters. لقطة استعلام ليست توزيع latency، وزمن العميل localhost لا يتضمن TLS/شبكة حقيقية.

## عزل التشغيل

1. تحقق من branch/status/HEAD وremote main دون تعديل checkout؛ احتفظ بكل تغييرات محلية. المصدر المفحوص هو SHA0713b6f4eb4da1df72ab6c4945608648192de8ef.
2. أنشئ directory جديدًا في tmp و`git archive` للـSHA؛ لا تستخدم DB/uploads أو.env الأصلي. في الفحص نُسخت node_modules إلى مساحة مستقلة للتحقق من القفل؛ يجب أن تتضمن بوابة CI المستقبلية fresh install مع postinstall وPrisma generate.
3. env للاختبار فقط: DATABASE_URL بمسار مطلق إلى audit.db، AUTH_SECRET عشوائي جديد، NEXTAUTH_URL/NEXT_PUBLIC_SITE_URL على loopback، EMAIL_DEV_MODE=true، وSMTP_HOST/USER/PASSWORD وNOTIFY_WEBHOOK_URL فارغة. **dev flag تحت production استُخدم عمدًا على loopback لإثبات F03، وليس إعداد نشر موصى به.**
4. migrations على DB فارغة، ثم seed roles/content، ثم fixtures المصطنعة. المحاولة الأولى فشلت كما تبين السجلات؛ لم نستخدم db push/reset لتجاوزها، ونجحت migrate deploy بعد إنشاء ملف DB وإعادة المحاولة.
5. راجع كل script قبل تشغيله. run.py يجلب env من مشروع tmp، لا من checkout الحقيقي؛ harnesses تعتمد المسار المعزول والـports3100/3101، ويمكن تغييرهما صراحة إلى مسارين جديدين مع الإبقاء على guard العزل.

مثال إنشاء env جديد **لا يطبع الأسرار**، يُنفذ من directory النسخة الجديدة فقط:

```python
from pathlib import Path
from secrets import token_hex

audit_project = Path.cwd().resolve()
assert str(audit_project).startswith('/tmp/so7ob-audit-')
assert audit_project != Path('/root/So7ob/Website')
values = {
    'DATABASE_URL': 'file:' + str(audit_project / 'prisma' / 'audit.db'),
    'AUTH_SECRET': token_hex(48),
    'NEXTAUTH_URL': 'http://localhost:3100',
    'NEXT_PUBLIC_SITE_URL': 'http://localhost:3100',
    'EMAIL_DEV_MODE': 'true',
    'SMTP_HOST': '', 'SMTP_USER': '', 'SMTP_PASSWORD': '',
    'NOTIFY_WEBHOOK_URL': '',
}
env_file = audit_project / '.env'
env_file.write_text('\n'.join(k + '=' + v for k, v in values.items()) + '\n')
env_file.chmod(0o600)
```

الفحوص المقاسة نفسها:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
git diff --check
```

على git archive لا يوجد `.git`؛ diffcheck يُنفذ في checkout الأصلي دون تغيير المصدر، وفحص whitespace للتقرير يُنفذ أيضًا. لإعادة test-node24، ضع Node24.21.0 المنفصل أول PATH ثم **نفس** `bun run test`. لا تثبته عبر تغيير package.json أو lock. engines لـVitest5/jsdom30 تفسر الفشل على Node20؛ لا تحذف اختبارFAQ.

## سيناريوهات تشغيل الأدلة

- مصدر `audit-fixtures.ts.txt` يولد8users/طلب/استفسار ومرفقين، ورسالة ظاهرة وملاحظة داخلية بعلامة مصطنعة. اقرأه وتأكد من DATABASE_URL المعزولة قبل نسخه إلى tmp وتشغيله.
- `api-audit.cjs.txt` يغطي الدخول والأدوار والملكية والنشر والتعارض وSVG والجلسات. ملفات fixtures الأولى في project/db/uploads بينما standalone يعمل من مجلد artifact؛404 الأولي دليل مشكلة path. نُسخت **ملفات الاختبار** إلى standalone/db/uploads فقط ثم أُعيد فحص ACL في more-audit.
- `audit-load-data.ts.txt` يضيف1000request و500message اصطناعية للـbenchmark. browser الأساسي سبق ذلك: مقارنة20 حالة لا تُخلط مع data load اللاحق.
- browser يستعمل Chromium headless، context بارد لكلزيارة،375/1280×ar/en، networkidle+500ms، reducedMotion=reduce، وحجب كل host خارجي. normal-home يغير الحركة فقط وينتظر1500ms للتأكد من ظهور المقدمة. لا CPU/network throttling أو INP measurement.
- bench يستعمل authenticated admin وHTTP localhost، GET100samples/10warmups بتزامن1/5؛ writes30/10 بتزامن1. زمن كاملbody، payload الحفظ صغير ودونrevision؛ اختبار صحةCAS منفصل.
- query instrumentation: نسخة مستقلة من `.next/standalone`، استبدال client logging مؤقتًا لإصدار query event دون params؛ تشغيل3101؛ trace لكلhandler مرة واحدة. لا تُجرى instrument mutations في src ولا يستخدم trace timing بدل uninstrumented API baseline.
- backup-probe استخدم SQLite WAL fixture مستقلة لتوضيح خطر raw copy، وonline backup في Python sqlite3 للمقارنة. لا نعتبر Python sqlite3 engine هو إصدار Prisma؛ إصدار3.46.0 جاء من query عبر Prisma.

## إعادة المقارنة بعد اعتماد التطوير

ثبت SHA/artifact/runtime وfixtures وعدد الرسائل/الكتل وcache/auth؛ شغّل3دورات API و≥5 cold browser visits لكلحالة، مع CPU/RSS/errors، ولا تشغّل فحوصًا أخرى تنافس القياس. أضف60block profiler وusable marker قبل اعتبار زمن فتح المحرر نتيجة قابلة للمقارنة. نفّذ خط أساس mobile-throttled قبل التطوير نفسه، ثم الظروف نفسها بعده. RUM/CrUX/SMTP/restore الإنتاجية تحتاج الوصول والموافقة والسياسات المناسبة، وهي غير متحققة في هذا التقرير.
