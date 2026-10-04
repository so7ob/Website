/**
 * نقل عقدة داخل شجرة المحتوى — قلب بند 1.2 (G2): السحب والإفلات في شجرة الطبقات.
 *
 * دالتان نقيتان (بلا React ولا toast):
 * - validateNodeMove: تحقق مسبق يعيد سبب الرفض أو null — لتُعرض رسالة صريحة
 *   أمام المستخدم قبل التطبيق (فلسفة «السبب أمام المستخدم لا في dev.log»).
 * - applyNodeMove: تنفيذ النقل على نسخة عميقة (structuredClone) — الشجرة الأصلية
 *   تبقى سليمة، والمعرفات كما هي (النقل لا يولد معرفات جديدة عكس اللصق).
 *
 * القيود نفسها المطبقة في اللصق (بند 1.1):
 * - MAX_TREE_NODES — حارس دفاعي: النقل لا يغيّر عدد العقد لكن العقد التصميمية
 *   تُفحص صراحةً حتى يبقى العقد موثقًا ومحصنًا ضد أي تغيير مستقبلي في المنطق
 * - MAX_TREE_DEPTH محسوبًا من موضع الهدف الفعلي (عمق الأب الهدف + 1)
 * - قواعد أبناء الحاوية الهدف (allowed + max) من BLOCK_REGISTRY
 * - منع الإفلات على العقدة نفسها أو داخل أحد أبنائها (منع الحلقات)
 * - إعادة الترتيب داخل نفس القائمة (الأب نفسه) بلا فحوص حاوية — العمق والعدد
 *   والقواعد ثابتة، وأي فحص إضافي سينتج إنذارات كاذبة (مثل صف ممتلئ أعمدته)
 */

import {
  BLOCK_REGISTRY,
  MAX_TREE_DEPTH,
  MAX_TREE_NODES,
  collectIds,
  countNodes,
  findNode,
  isContainerType,
  maxDepth,
  type ContentNode,
} from "./tree";

export type MoveNodeError =
  | "notFound"
  | "selfDrop"
  | "descendantDrop"
  | "nodesLimit"
  | "depthLimit"
  | "typeNotAllowed"
  | "containerFull";

export type NodeMoveCheck = { ok: true } | { ok: false; error: MoveNodeError; max?: number };

/** طول مسار الآباء لعقدة (الجذر = 0) — null إن لم توجد */
function pathLength(nodes: ContentNode[], id: string, depth = 0): number | null {
  for (const node of nodes) {
    if (node.id === id) return depth;
    if (node.children?.length) {
      const found = pathLength(node.children, id, depth + 1);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * التحقق من نقل عقدة (بشجرتها) إلى موضع جديد:
 * targetParentId = null يعني الجذر، وinsertIndex فهرس الإدراج ضمن قائمة الأبناء
 * الهدف (يُمشَّط لاحقًا في التطبيق — التحقق لا يعتمد على حدوده).
 */
export function validateNodeMove(
  tree: ContentNode[],
  id: string,
  targetParentId: string | null,
  _insertIndex: number
): NodeMoveCheck {
  const active = findNode(tree, id);
  if (!active) return { ok: false, error: "notFound" };

  const currentParentId = active.parent?.id ?? null;

  if (targetParentId !== null) {
    if (targetParentId === id) return { ok: false, error: "selfDrop" };

    // الحلقة: الهدف داخل شجرة العقدة المنقولة نفسها
    if (collectIds([active.node]).has(targetParentId)) {
      return { ok: false, error: "descendantDrop" };
    }

    const target = findNode(tree, targetParentId);
    if (!target) return { ok: false, error: "notFound" };

    if (currentParentId !== targetParentId) {
      // نقل عبر الحاويات — قواعد الحاوية الهدف تُطبق بالكامل
      if (!isContainerType(target.node.type)) return { ok: false, error: "typeNotAllowed" };
      const rule = BLOCK_REGISTRY[target.node.type].children;
      if (!rule) return { ok: false, error: "typeNotAllowed" };
      if (!rule.allowed.includes(active.node.type)) return { ok: false, error: "typeNotAllowed" };
      if ((target.node.children?.length ?? 0) >= rule.max) {
        return { ok: false, error: "containerFull", max: rule.max };
      }
    }
  }

  // عمق الهبوط للعقدة المنقولة: الجذر = 1، وأب حاوية على مسار طوله L ⇒ أبناؤه
  // على العمق L + 2. الفحص: عمق الهبوط + ارتفاع الشجرة الفرعية − 1 ≤ الحد —
  // وهو نفس عقد صلاحية الشجرة، فالنقل داخل نفس الأب لا ينتج إنذارًا كاذبًا أبدًا.
  const parentPathLength = targetParentId === null ? 0 : pathLength(tree, targetParentId);
  if (parentPathLength === null) return { ok: false, error: "notFound" };
  const landingDepth = targetParentId === null ? 1 : parentPathLength + 2;
  if (landingDepth + maxDepth([active.node]) - 1 > MAX_TREE_DEPTH) {
    return { ok: false, error: "depthLimit" };
  }

  // حارس دفاعي — النقل الصرف لا يغيّر العدد، لكن العقد التصميمية تُفحص صراحة
  if (countNodes(tree) > MAX_TREE_NODES) return { ok: false, error: "nodesLimit" };

  return { ok: true };
}

/**
 * تنفيذ النقل على نسخة عميقة — يفشل بهدوء (يعيد المرجع نفسه) إن كان النقل
 * غير صالح؛ المتصل يتحقق أولًا بـ validateNodeMove ليعرض سبب الرفض.
 * دلالات الفهرس بعد الإزالة: إن كان oldIndex قبل موضع الإدراج يُنقص الفهرس
 * واحدًا (دلالات arrayMove القياسية)، والفهرس يُمشَّط لحدود القائمة.
 */
export function applyNodeMove(
  tree: ContentNode[],
  id: string,
  targetParentId: string | null,
  insertIndex: number
): ContentNode[] {
  if (!validateNodeMove(tree, id, targetParentId, insertIndex).ok) return tree;
  const clone = structuredClone(tree);
  const active = findNode(clone, id);
  if (!active) return clone;

  const sourceSiblings = active.siblings;
  const oldIndex = sourceSiblings.findIndex((n) => n.id === id);
  if (oldIndex < 0) return clone;
  const [moved] = sourceSiblings.splice(oldIndex, 1);

  let targetList: ContentNode[];
  if (targetParentId === null) {
    targetList = clone;
  } else {
    const target = findNode(clone, targetParentId);
    if (!target) return clone;
    if (target.node.children) {
      targetList = target.node.children;
    } else {
      targetList = [];
      target.node.children = targetList;
    }
  }
  if (!targetList) return clone;

  const sameList = targetList === sourceSiblings;
  let idx = insertIndex;
  if (sameList && oldIndex < idx) idx -= 1;
  idx = Math.max(0, Math.min(idx, targetList.length));
  targetList.splice(idx, 0, moved);
  return clone;
}
