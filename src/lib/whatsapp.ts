import {
  arrearsFor,
  minimumFor,
  money,
  paidFor,
  statusFor,
  type Member,
  type TreasuryState,
} from "./domain";

export function normalizeMoroccanPhone(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, "");
  let national = compact;
  if (/^0[67]\d{8}$/.test(compact)) national = `212${compact.slice(1)}`;
  else if (/^\+212[67]\d{8}$/.test(compact)) national = compact.slice(1);
  else if (/^00212[67]\d{8}$/.test(compact)) national = compact.slice(2);
  return /^212[67]\d{8}$/.test(national) ? national : null;
}
export type Template = "friendly" | "remaining" | "arrears" | "receipt";
export function privateMessage(
  state: TreasuryState,
  member: Member,
  month: string,
  adminName: string,
  kind: Template,
): string {
  const due = minimumFor(state, month);
  const paid = paidFor(state, member.id, month);
  const arrears = arrearsFor(state, member, month);
  const eligible = state.members.filter(
    (m) =>
      m.active &&
      m.joinedMonth <= month &&
      statusFor(state, m.id, month) !== "waived",
  );
  const completed = eligible.filter(
    (m) => paidFor(state, m.id, month) >= minimumFor(state, month),
  ).length;
  const rate = eligible.length
    ? Math.round((completed / eligible.length) * 100)
    : 0;
  const messages: Record<Template, string> = {
    friendly: `السلام عليكم ${member.name}، تذكير ودي بمساهمة شهر ${month} فالـصندوق: ${money(due)}. راه وصلنا لـ ${rate}% من المساهمات ديال هاد الشهر. شكراً بزاف!`,
    remaining: `السلام عليكم ${member.name}، شكراً على ${money(paid)} اللي ساهمت بها فشهر ${month}. باقي غير ${money(Math.max(0, due - paid))} باش تكمل الحد الأدنى. الله يجازيك بخير.`,
    arrears: `السلام عليكم ${member.name}، تذكير بكل احترام: باقي عندك ${arrears.count} شهر/شهور ما تكملوش، بمجموع ${money(arrears.amount)}. إلى كان شي إشكال خبرنا باش نلقاو حل.`,
    receipt: `السلام عليكم ${member.name}، تأكيد التوصل بمساهمتك لشهر ${month}: ${money(paid)}. الحالة: ${paid >= due ? "خالص" : "جزئي"}. شكراً على المساهمة ديالك.`,
  };
  return `${messages[kind]}\n\n— مع تحيات ${adminName}`;
}
export function whatsappUrl(phone: string, message: string): string | null {
  const normalized = normalizeMoroccanPhone(phone);
  return normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : null;
}
