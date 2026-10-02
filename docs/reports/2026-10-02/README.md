# تقرير الفحص وحالة الدفعة الأولى

[التقرير](REPORT.ar.md) و[أدلة إعادة القياس](REPRODUCE.ar.md) و[مسودات الخطة](GITHUB-DRAFTS.ar.md) توثّق الفحص على النسخة `0713b6f4`. عباراتها عن عدم بدء التنفيذ أو عدم إنشاء Issues تصف وقت الفحص؛ لا تعني أن التنفيذ لم يبدأ لاحقًا. أُبقيت الأدلة التاريخية كما هي.

بتفويض المستخدم بالمراجعة والدمج، أُدخلت الدفعة التالية إلى `main` عبر GitHub:

| الحزمة | Issue | Pull Request |
|---|---|---|
| W01: البيانات الدائمة والنسخ والاستعادة | [#11](https://github.com/so7ob/Website/issues/11) | [#12](https://github.com/so7ob/Website/pull/12) |
| W02: رموز الملكية والاستهلاك الذري | [#13](https://github.com/so7ob/Website/issues/13) | [#15](https://github.com/so7ob/Website/pull/15) |
| W03a: خصوصية سجل البريد | [#14](https://github.com/so7ob/Website/issues/14) | [#17](https://github.com/so7ob/Website/pull/17) |
| W03b: الوصول إلى المرفقات والصفحات واللوحة | [#16](https://github.com/so7ob/Website/issues/16) | [#20](https://github.com/so7ob/Website/pull/20) |
| W03c: التحقق من الملفات ومنع SVG | [#18](https://github.com/so7ob/Website/issues/18) | [#19](https://github.com/so7ob/Website/pull/19) |

تتضمن PRs نتائج الفحوص وخطط التراجع ومراجعة الوكيل المنفذ. اختبارات الجمع السابقة نجحت بـ133 اختبارًا؛ هذا لا يمثل اختبار حمل إنتاج أو مراجعة مستقلة أو إتمام بقية الخطة. بقية المراحل والقرارات المشروطة في التقرير ما زالت أعمالًا لاحقة، وIssue #8 أوسع من الإصلاحات المنجزة فلا يُغلق بالكامل لهذه الدفعة.

أدلة التشغيل والترحيل والقيود في [docs/operations](../../operations). اتبع [CONTRIBUTING](../../../CONTRIBUTING.md) للعمل على Issue وفرع مستقل داخل المسار المحلي المحدد، ثم الفحص والرفع وPR والمراجعة والدمج عند التفويض وتحديث `main` المحلي.
