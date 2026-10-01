"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * الرسمة الافتتاحية: «سحابة من الأفكار تمطر حلولًا رقمية».
 * طبقات سحابية متدرجة + أقواس كود + قطرات بكسلية تصبح بطاقات واجهة.
 * حركة خفيفة تُعطَّل تلقائيًا مع تفضيل تقليل الحركة.
 */
export function CloudHeroArt() {
  const reduce = useReducedMotion();
  const float = (delay: number, y = 10) =>
    reduce
      ? {}
      : {
          animate: { y: [0, -y, 0] },
          transition: { duration: 6, delay, repeat: Infinity, ease: "easeInOut" as const },
        };

  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
      <svg viewBox="0 0 520 460" fill="none" className="h-auto w-full drop-shadow-sm">
        <defs>
          <linearGradient id="cloudBody" x1="120" y1="80" x2="420" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E0F2FE" />
            <stop offset="0.55" stopColor="#BAE6FD" />
            <stop offset="1" stopColor="#7DD3FC" />
          </linearGradient>
          <linearGradient id="cloudBack" x1="80" y1="140" x2="460" y2="340" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F0F9FF" />
            <stop offset="1" stopColor="#E0F2FE" />
          </linearGradient>
          <linearGradient id="codeChip" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#0B1F3A" />
            <stop offset="1" stopColor="#0B1F3A" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* سحابة خلفية شفافة */}
        <g opacity="0.65">
          <ellipse cx="140" cy="270" rx="95" ry="58" fill="url(#cloudBack)" />
          <ellipse cx="255" cy="235" rx="120" ry="75" fill="url(#cloudBack)" />
          <ellipse cx="385" cy="280" rx="100" ry="60" fill="url(#cloudBack)" />
        </g>

        {/* السحابة الرئيسية */}
        <g>
          <path
            d="M140 300c-42 0-74-30-74-68 0-34 26-62 60-67 8-49 51-86 103-86 45 0 84 28 98 68 6-2 13-3 20-3 38 0 69 30 69 68s-31 68-69 68H140z"
            fill="url(#cloudBody)"
          />
          <path
            d="M140 300c-42 0-74-30-74-68 0-34 26-62 60-67 8-49 51-86 103-86 45 0 84 28 98 68 6-2 13-3 20-3 38 0 69 30 69 68s-31 68-69 68H140z"
            stroke="#38BDF8"
            strokeOpacity="0.5"
            strokeWidth="2"
          />
        </g>

        {/* أقواس الكود داخل السحابة */}
        <motion.g {...float(0, 8)}>
          <rect x="212" y="128" width="96" height="86" rx="16" fill="url(#codeChip)" />
          <text x="236" y="186" fill="#7DD3FC" fontSize="44" fontWeight="700" fontFamily="monospace">
            {"<>"}
          </text>
          <rect x="278" y="150" width="14" height="4" rx="2" fill="#38BDF8" opacity="0.9" />
          <rect x="278" y="160" width="20" height="4" rx="2" fill="#38BDF8" opacity="0.6" />
          <rect x="278" y="170" width="10" height="4" rx="2" fill="#38BDF8" opacity="0.4" />
        </motion.g>

        {/* خطوط قطرات البكسل المتساقطة */}
        {[
          { x: 150, ys: [318, 342, 368], r: [4, 5.5, 3.5] },
          { x: 208, ys: [332, 360, 386], r: [5.5, 4, 6] },
          { x: 266, ys: [320, 348, 376, 398], r: [4.5, 6, 4, 5] },
          { x: 324, ys: [336, 362, 390], r: [6, 4.5, 5.5] },
          { x: 378, ys: [322, 350, 374], r: [4, 5.5, 4] },
        ].map((col, ci) => (
          <g key={ci}>
            {col.ys.map((y, i) => (
              <motion.circle
                key={i}
                cx={col.x}
                cy={y}
                r={col.r[i]}
                fill={i === col.ys.length - 1 ? "#0369A1" : "#38BDF8"}
                opacity={0.9 - i * 0.12}
                {...(reduce
                  ? {}
                  : {
                      animate: { y: [0, 6, 0], opacity: [0.9 - i * 0.12, 0.5, 0.9 - i * 0.12] },
                      transition: { duration: 3.2, delay: ci * 0.35 + i * 0.4, repeat: Infinity, ease: "easeInOut" as const },
                    })}
              />
            ))}
          </g>
        ))}

        {/* بطاقة واجهة صغيرة تتحول من قطرة */}
        <motion.g {...float(1.2, 12)}>
          <rect x="404" y="352" width="92" height="64" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          <rect x="414" y="364" width="34" height="7" rx="3.5" fill="#0B1F3A" opacity="0.85" />
          <rect x="414" y="378" width="60" height="5" rx="2.5" fill="#94A3B8" />
          <rect x="414" y="390" width="48" height="5" rx="2.5" fill="#CBD5E1" />
          <rect x="414" y="402" width="28" height="8" rx="4" fill="#0369A1" />
        </motion.g>

        {/* أقواس عائمة */}
        <motion.g {...float(0.6, 10)}>
          <text x="58" y="120" fill="#6D28D9" fontSize="40" fontWeight="600" fontFamily="monospace" opacity="0.75">
            {"{"}
          </text>
        </motion.g>
        <motion.g {...float(1.8, 8)}>
          <text x="452" y="150" fill="#0369A1" fontSize="40" fontWeight="600" fontFamily="monospace" opacity="0.65">
            {"}"}
          </text>
        </motion.g>

        {/* شبكة نقاط خفيفة */}
        <g fill="#94A3B8" opacity="0.35">
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].map((c) => <circle key={`${r}-${c}`} cx={48 + c * 14} cy={396 + r * 14} r="1.6" />)
          )}
        </g>
      </svg>
    </div>
  );
}
