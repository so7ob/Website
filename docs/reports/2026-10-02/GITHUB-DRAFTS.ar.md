# مسودات Issues وPull Requests لخطة سُحُب التقنية

هذه نصوص مراجعة محلية. لم تُنشأ Issues أو فروع أو PRs، ولم يُدفع شيء. تفاصيل الجهد والاعتماديات والترحيل والاختبارات والتراجع لكل حزمة في [القسم7 من التقرير](REPORT.ar.md#7-خطة-انتقال-ومراحل-وissuesprs-مقترحة). W01–W16 رموز الخطة وليست أرقام GitHub.

| المسودة | عنوان Issue/PR مقترح | الفرع بعد رقم Issue حقيقي | النتائج المرتبطة |
|---|---|---|---|
| W01 | تثبيت مسارات البيانات ونسخ SQLite والملفات واستعادتها | `fix/<issue-number>-persistent-data-backup` | F11 وF03 للـboot validation |
| W02 | ربط رموز إثبات ملكية الطلب بالمورد واستهلاكها ذريًا | `fix/<issue-number>-claim-resource-binding` | F01/F03/F10/F17 |
| W03a | منع تخزين وعرض روابط الحساب السرية في outbox | `fix/<issue-number>-outbox-secret-redaction` | F02 |
| W03b | توحيد صلاحيات الاستفسارات واللوحة وmetadata المقيدة | `fix/<issue-number>-private-resource-access` | F05/F06/F07 |
| W03c | منع الوسائط النشطة وفحص أنواع وحجم الملفات | `fix/<issue-number>-media-upload-validation` | F04 |
| W04 | منع الحفظ المتعارض بإصدار مسودة وتحديث ذري | `fix/<issue-number>-atomic-draft-revisions` | F09 |
| W05a | حفظ snapshots كاملة للمسودة والمنشور دون تغيير المحتوى | `feature/<issue-number>-page-snapshots` | F08/F26 |
| W05b | نشر واستعادة وإصدارات مستقلة لكل لغة | `feature/<issue-number>-locale-publication` | F13 |
| W06 | تحديث الإطار والحزم الأمنية وتثبيت بيئة التشغيل | `chore/<issue-number>-runtime-security-updates` | F12/F27 |
| W07 | تثبيت الجلسات والتحقق الخادمي وحدود المعدل | `fix/<issue-number>-session-validation-controls` | F14/F15/F18/F19/F20/F28 |
| W08a | معاملات وإعادة محاولة آمنة للطلبات والاستفسارات | `fix/<issue-number>-message-idempotency` | F16 |
| W08b | outbox دائم للبريد مع worker وإعادة محاولة | `feature/<issue-number>-durable-mail-outbox` | F21/F02 |
| W09 | تنظيم وحدات الخدمة وإضافة اختبارات قاعدة ومتصفح وصلاحيات | `chore/<issue-number>-integration-quality-gates` | F27 |
| W10a | محرر نص غني مقيد مع round-trip وRTL | `feature/<issue-number>-restricted-rich-text` | فجوة النص الغني |
| W10b | تخطيطات كتل متداخلة مع سحب ولوحة مفاتيح | `feature/<issue-number>-nested-block-layouts` | فجوة التخطيط |
| W10c | مكتبة قوالب قابلة للمراجعة مع إصدارات | `feature/<issue-number>-page-template-library` | فجوة القوالب |
| W11 | روابط متابعة وسياسات view/reply/account مع إلغاء وانتهاء | `feature/<issue-number>-resource-tracking-links` | متطلبات guest lifecycle |
| W12a | إظهار مقدمة الموقع مع تقليل الحركة وتصحيح ARIA والتباين | `fix/<issue-number>-accessible-motion-layout` | F24 |
| W12b | معاينة viewport صحيحة وحماية التعديلات عند التنقل | `feature/<issue-number>-editor-preview-recovery` | F24/F25 |
| W13 | تقليل JavaScript واستعلامات وحجم المحادثات بقياسات ثابتة | `chore/<issue-number>-measured-performance` | F22/F23 |
| W14 | مراقبة التشغيل ودليل الإطلاق والاستعادة | `chore/<issue-number>-operational-readiness` | F11/F21 |
| W15 | نقل مدروس إلى PostgreSQL عند اعتماد شرط التوسع | `feature/<issue-number>-postgres-cutover` | قرار مشروط، ليس طلب تنفيذ الآن |
| W16 | إزالة التبعيات المثبت عدم استخدامها | `chore/<issue-number>-unused-dependency-cleanup` | جرد التبعيات |

يمكن تقسيم W07/W13 إلى عدة Issues إذا اتسع diff. كل فرع موضوع واحد؛ الترقيات الكبرى/DB/CMS لا تُجمع في PR واحد. W03/W05/W08/W10 تعرض تقسيمات مقترحة لتقليل اقتران المراجعة؛ التفاصيل المشتركة من الحزمة الأم تبقى في كل Issue ذي صلة.

## نص Issue جاهز للتعبئة بعد اعتماد الحزمة

```markdown
المشكلة والهدف:
[وصف الحزمة من التقرير، مع نتيجة Fxx ودليل الملف والموضع. اذكر السلوك الحالي والمرغوب بمثال محدد.]

النطاق:
[الملفات والوحدات والتغيير التقني للحزمة من جدول القسم7.]

خارج النطاق:
[تغييرات الإنتاج أو الحزم أو نموذج البيانات غير اللازمة لهذه الحزمة؛ لا توسعة تلقائية.]

الاعتماديات والترحيل:
[رموز الحزم السابقة، وأرقام Issues بعد إنشائها. إن كانت البيانات قائمة، backup/restore وexpand/contract وخطة التعامل مع العملاء القديمة.]

معايير القبول والاختبارات:
[المعايير المحددة من جدول الحزمة والقسم6، بما فيها رفض العميل/الموقوف/غير المالك، لا النجاح فقط.]

المخاطر والجهد:
[نطاق أيام العمل وحدود عدم اليقين من التقرير.]

التراجع:
[تراجع الكود منفصلًا عن reverse migration/استعادة DB/files/jobs إن لزم.]
```

## مسودة PR نموذجية للحزمة W02

العنوان: `fix: bind request claim verification to its resource`.

```markdown
## الوصف

رمز إثبات ملكية الطلب الحالي مرتبط بالمستخدم والغرض فقط؛ يمكن تغيير مرجع الطلب واستخدامه لربط مورد آخر له pending claim. تربط هذه الحزمة الرمز بالطلب وطلب الربط والمستخدم، وتستهلكه مع نقل الملكية في عملية ذرية.

Closes #<issue-number>

## ما الذي تغيّر

- token binding صريح للمورد، وإلغاء الاعتماد على refCode وحده لإثبات الملكية.
- رفض استعمال الرمز مع جلسة أو مورد مختلف، واستهلاك واحد تحت التزامن.
- انتهاء وإعادة إرسال pending claim دون تعطيل المالك أو رموز موارده الأخرى.
- عدم إرجاع روابط البريد السرية في وضع الإنتاج.

## صور الواجهات

[تضاف ar/en و375/1280 إذا تغيرت الواجهة؛ لا توضع صور مصطنعة باعتبارها نتيجة الإصلاح.]

## الاختبارات والفحوص

[تبقى غير معلّمة حتى تُنفذ فعلًا.]
- [ ] bun run lint
- [ ] bun run typecheck
- [ ] bun run test، مع ذكر العدد
- [ ] bun run build
- [ ] git diff --check
- [ ] GitHub Actions ناجحة
- [ ] رمز واحد/10 طلبات، تبديل ref/resource/user، expired/revoked، owner/nonowner/suspended، وتدفق بريد وهمي

## الإعدادات المطلوبة والقيود

[اسم migration، backup/restore المتحقق، إبطال الرموز القديمة وإعادة إصدارها، وقيود SMTP. لا قيم أسرار.]

## طريقة التراجع

الأعمدة additive تبقى؛ إصدار التراجع يجب أن يفهم binding الجديد أو يعطل claim بوضوح. لا تعاد الرموز غير المربوطة إلى العمل. استعادة البيانات بعد عمليات ربط جديدة تحتاج journal/reverse action معتمدًا، وليست إعادة نشر binary قديم فقط.
```

بوابات المراجعة العامة تعتمد [قالب المشروع](/root/So7ob/Website/.github/PULL_REQUEST_TEMPLATE.md) و[CONTRIBUTING](/root/So7ob/Website/CONTRIBUTING.md). تنطبق صياغة PR على النتيجة النهائية فقط، ويُعاد كتابة العنوان/الوصف إذا تغير النطاق.
