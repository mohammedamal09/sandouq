"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  allocationPreview,
  arrearsFor,
  minimumFor,
  money,
  newId,
  paidFor,
  statusFor,
  toMonth,
  type AllocationMode,
  type Category,
  type Channel,
  type Command,
  type Expense,
  type Member,
  type TreasuryState,
} from "@/lib/domain";
import { groupReport } from "@/lib/report";
import { privateMessage, type Template, whatsappUrl } from "@/lib/whatsapp";
import { Amount, Private, StatusBadge } from "./display";
import { ReceiptButton } from "./receipt-button";
import { RecordActions } from "./record-actions";

type Dispatch = (command: Command, receipt?: File) => boolean;
const toCents = (text: string) =>
  Math.round(Number(text.replace(",", ".")) * 100);
const titleOf = (month: string) =>
  new Intl.DateTimeFormat("ar-MA-u-nu-latn", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));

export function PaymentDrawer({
  state,
  member,
  month,
  adminId,
  privacy,
  onClose,
  dispatch,
}: {
  state: TreasuryState;
  member: Member | null;
  month: string;
  adminId: string;
  privacy: boolean;
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const remaining = member
    ? Math.max(0, minimumFor(state, month) - paidFor(state, member.id, month))
    : 0;
  const [amount, setAmount] = useState(String(remaining / 100));
  const [channel, setChannel] = useState<Channel>("cash");
  const [mode, setMode] = useState<AllocationMode>("bonus");
  let preview: ReturnType<typeof allocationPreview> = [];
  try {
    if (member && toCents(amount) > 0)
      preview = allocationPreview(
        state,
        member.id,
        month,
        toCents(amount),
        mode,
      );
  } catch {
    /* validation on save */
  }
  return (
    <Drawer
      open={!!member}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      direction="bottom"
    >
      <DrawerContent
        dir="rtl"
        className="mx-auto max-h-[85dvh] max-w-lg"
      >
        <DrawerHeader className="text-start">
          <DrawerTitle>تسجيل مساهمة</DrawerTitle>
          <DrawerDescription>
            <Private hidden={privacy}>{member?.name ?? ""}</Private> ·{" "}
            {titleOf(month)}
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4">
          <div>
            <Label htmlFor="pay-amount">المبلغ (DH)</Label>
            <Input
              id="pay-amount"
              className={`mt-2 text-start numeric ${privacy ? "private-blur" : ""}`}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              الباقي للحد الأدنى: <Amount value={remaining} hidden={privacy} />
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              ["الحد الأدنى", remaining],
              ["+20", remaining + 2000],
              ["+50", remaining + 5000],
              ["+100", remaining + 10000],
            ].map(([label, cents]) => (
              <Button
                key={String(label)}
                variant="outline"
                size="sm"
                className="px-1"
                onClick={() => setAmount(String(Number(cents) / 100))}
              >
                {label}
              </Button>
            ))}
          </div>
          <div>
            <Label>طريقة الأداء</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant={channel === "cash" ? "default" : "outline"}
                onClick={() => setChannel("cash")}
              >
                كاش
              </Button>
              <Button
                variant={channel === "bank" ? "default" : "outline"}
                onClick={() => setChannel("bank")}
              >
                بنكة
              </Button>
            </div>
          </div>
          {toCents(amount) > remaining && (
            <div>
              <Label>الفائض</Label>
              <div className="mt-2 grid gap-2">
                <Button
                  variant={mode === "bonus" ? "secondary" : "outline"}
                  className="justify-start"
                  onClick={() => setMode("bonus")}
                >
                  فوق الخير لهاد الشهر
                </Button>
                <Button
                  variant={mode === "prepay" ? "secondary" : "outline"}
                  className="justify-start"
                  onClick={() => setMode("prepay")}
                >
                  تسبيق للشهور الجاية
                </Button>
              </div>
            </div>
          )}
          {!!preview.length && (
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-3 text-xs">
              <p className="mb-2 font-semibold">توزيع المبلغ</p>
              {preview.map((part) => (
                <div key={part.month} className="flex justify-between py-1">
                  <span>{titleOf(part.month)}</span>
                  <Private hidden={privacy} className="numeric">
                    {money(part.base + part.bonus)}
                    {part.bonus > 0 ? " + bonus" : ""}
                  </Private>
                </div>
              ))}
            </div>
          )}
        </div>
        <DrawerFooter className="border-t border-zinc-100 dark:border-white/10">
          <Button
            onClick={() => {
              if (!member) return;
              const ok = dispatch({
                id: newId(),
                type: "payment",
                adminId,
                memberId: member.id,
                month,
                amount: toCents(amount),
                channel,
                mode,
                at: new Date().toISOString(),
              });
              if (ok) onClose();
            }}
          >
            تسجيل الأداء
          </Button>
          {member && paidFor(state, member.id, month) === 0 && (
            <Button
              variant="outline"
              onClick={() => {
                if (
                  dispatch({
                    id: newId(),
                    type: "waiver",
                    adminId,
                    memberId: member.id,
                    month,
                    at: new Date().toISOString(),
                  })
                )
                  onClose();
              }}
            >
              إعفاء هاد الشهر
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function EditContributionDialog({
  state,
  member,
  month,
  adminId,
  privacy,
  onClose,
  dispatch,
}: {
  state: TreasuryState;
  member: Member | null;
  month: string;
  adminId: string;
  privacy: boolean;
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const current = member ? paidFor(state, member.id, month) : 0;
  const [amount, setAmount] = useState(String(current / 100));
  const [expectedRevision] = useState(state.revision);
  const [channel, setChannel] = useState<Channel>("cash");
  const [mode, setMode] = useState<AllocationMode>("bonus");
  const status = member ? statusFor(state, member.id, month) : "unpaid";
  const submit = (nextAmount: number) => {
    if (!member) return;
    if (
      dispatch({
        id: newId(),
        type: "monthly_contribution",
        adminId,
        memberId: member.id,
        month,
        amount: nextAmount,
        channel,
        mode,
        expectedRevision,
        at: new Date().toISOString(),
      })
    )
      onClose();
  };
  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent dir="rtl" className="max-h-[85dvh] max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>تعديل المساهمة</DialogTitle>
          <DialogDescription>
            <Private hidden={privacy}>{member?.name}</Private> · {titleOf(month)}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          {status === "waived" && (
            <p className="rounded-md border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              هذا الشهر معفي. إدخال مبلغ يلغي الإعفاء ويسجل مساهمة جديدة.
            </p>
          )}
          <div>
            <Label htmlFor="edit-contribution-amount">المبلغ (DH)</Label>
            <Input
              id="edit-contribution-amount"
              className={`numeric mt-2 text-start ${privacy ? "private-blur" : ""}`}
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {toCents(amount) > minimumFor(state, month) && (
            <div>
              <Label>توزيع الفائض</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant={mode === "bonus" ? "secondary" : "outline"} onClick={() => setMode("bonus")}>فوق الخير</Button>
                <Button variant={mode === "prepay" ? "secondary" : "outline"} onClick={() => setMode("prepay")}>تسبيق</Button>
              </div>
            </div>
          )}
          <div>
            <Label>طريقة الأداء الجديدة</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant={channel === "cash" ? "default" : "outline"} onClick={() => setChannel("cash")}>كاش</Button>
              <Button variant={channel === "bank" ? "default" : "outline"} onClick={() => setChannel("bank")}>بنكة</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => submit(toCents(amount))}>حفظ التعديل</Button>
          <Button variant="outline" onClick={() => submit(0)}>إلغاء المساهمة</Button>
          <Button variant="ghost" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseDrawer({
  state,
  open,
  editingExpense,
  adminId,
  privacy,
  onClose,
  dispatch,
}: {
  state: TreasuryState;
  open: boolean;
  editingExpense?: Expense | null;
  adminId: string;
  privacy: boolean;
  onClose: () => void;
  dispatch: Dispatch;
}) {
  const [expectedRevision] = useState(state.revision);
  const [title, setTitle] = useState(editingExpense?.title ?? "");
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount / 100) : "");
  const [category, setCategory] = useState<Category>(editingExpense?.category ?? "activities");
  const [source, setSource] = useState<"direct" | "offset">(editingExpense?.source ?? "direct");
  const [channel, setChannel] = useState<Channel>(editingExpense?.channel ?? "cash");
  const [memberId, setMemberId] = useState(editingExpense?.memberId ?? "");
  const [mode, setMode] = useState<AllocationMode>("bonus");
  const [note, setNote] = useState(editingExpense?.note ?? "");
  const [spentAt, setSpentAt] = useState(editingExpense?.spentAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [receipt, setReceipt] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const member = state.members.find((m) => m.id === memberId);
  const previewState = useMemo(() => {
    if (!editingExpense) return state;
    const copy = structuredClone(state);
    const expense = copy.expenses.find((item) => item.id === editingExpense.id);
    if (expense) expense.reversedAt = "preview";
    const credit = copy.payments.find((item) => item.expenseId === editingExpense.id && !item.reversedAt);
    if (credit) credit.reversedAt = "preview";
    return copy;
  }, [state, editingExpense]);
  const receiptPreview = useMemo(
    () => (receipt ? URL.createObjectURL(receipt) : ""),
    [receipt],
  );
  useEffect(
    () => () => {
      if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    },
    [receiptPreview],
  );
  const remaining = member
    ? Math.max(
        0,
        minimumFor(previewState, spentAt.slice(0, 7)) -
          paidFor(previewState, member.id, spentAt.slice(0, 7)),
      )
    : 0;
  let offsetPreview: ReturnType<typeof allocationPreview> = [];
  try {
    if (source === "offset" && member && toCents(amount) > 0)
      offsetPreview = allocationPreview(
        previewState,
        member.id,
        spentAt.slice(0, 7),
        toCents(amount),
        mode,
      );
  } catch {
    /* validation on save */
  }
  const categories: Record<Category, string> = {
    activities: "أنشطة",
    logistics: "لوجيستيك",
    aid: "مساعدات",
    emergency: "طوارئ",
    other: "أخرى",
  };
  return (
    <Drawer
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      direction="bottom"
    >
      <DrawerContent
        dir="rtl"
        className="mx-auto max-h-[85dvh] max-w-lg"
      >
        <DrawerHeader className="text-start">
          <DrawerTitle>{editingExpense ? "تعديل المصروف" : "قيد مصروف"}</DrawerTitle>
          <DrawerDescription>سجل التفاصيل وطريقة الأداء</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          <div>
            <Label htmlFor="expense-title">السبب / الغرض</Label>
            <Input
              id="expense-title"
              className="mt-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً لوازم النشاط"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="expense-amount">المبلغ (DH)</Label>
              <Input
                id="expense-amount"
                className={`numeric mt-2 text-start ${privacy && source === "offset" ? "private-blur" : ""}`}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expense-date">التاريخ</Label>
              <Input
                id="expense-date"
                className="numeric mt-2"
                type="date"
                lang="en"
                dir="ltr"
                value={spentAt}
                onChange={(e) => setSpentAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>الصنف</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {Object.entries(categories).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div>
            <Label>شكون خلّص؟</Label>
            <div className="mt-2 grid gap-2">
              <Button
                variant={source === "direct" ? "secondary" : "outline"}
                className="justify-start"
                onClick={() => setSource("direct")}
              >
                من الصندوق نيشان
              </Button>
              <Button
                variant={source === "offset" ? "secondary" : "outline"}
                className="justify-start"
                onClick={() => setSource("offset")}
              >
                عضو خلّص من جيبو — مقاصة
              </Button>
            </div>
          </div>
          {source === "direct" ? (
            <div>
              <Label>الحساب</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  variant={channel === "cash" ? "default" : "outline"}
                  onClick={() => setChannel("cash")}
                >
                  كاش
                </Button>
                <Button
                  variant={channel === "bank" ? "default" : "outline"}
                  onClick={() => setChannel("bank")}
                >
                  بنكة
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>العضو</Label>
                <Select value={memberId} onValueChange={setMemberId}>
                  <SelectTrigger
                    className={`mt-2 w-full ${privacy ? "private-blur" : ""}`}
                  >
                    <SelectValue placeholder="اختار العضو" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {state.members
                      .filter((m) => m.active || m.id === memberId)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <Private hidden={privacy}>{m.name}</Private>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {toCents(amount) > remaining && member && (
                <div>
                  <Label>توزيع المقاصة</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant={mode === "bonus" ? "secondary" : "outline"}
                      onClick={() => setMode("bonus")}
                    >
                      فوق الخير
                    </Button>
                    <Button
                      variant={mode === "prepay" ? "secondary" : "outline"}
                      onClick={() => setMode("prepay")}
                    >
                      تسبيق
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          {source === "offset" && !!offsetPreview.length && (
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-3 text-xs">
              <p className="mb-2 font-semibold">توزيع المقاصة</p>
              {offsetPreview.map((part) => (
                <div key={part.month} className="flex justify-between py-1">
                  <span>{titleOf(part.month)}</span>
                  <Private hidden={privacy} className="numeric">
                    {money(part.base + part.bonus)}
                  </Private>
                </div>
              ))}
            </div>
          )}
          <div>
            <Label htmlFor="expense-note">ملاحظة الوصل (اختياري)</Label>
            <Textarea
              id="expense-note"
              className="mt-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="receipt-file">صورة الوصل (اختياري)</Label>
            {editingExpense?.receiptId && !removeReceipt && !receipt && (
              <div className="mt-2 flex items-center gap-2">
                <ReceiptButton receiptId={editingExpense.receiptId} privacy={privacy} />
                <Button size="sm" variant="ghost" onClick={() => setRemoveReceipt(true)}>إزالة الوصل</Button>
              </div>
            )}
            <Input
              id="receipt-file"
              className="mt-2"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (
                  file &&
                  (file.size > 5 * 1024 * 1024 ||
                    !["image/png", "image/jpeg", "image/webp"].includes(
                      file.type,
                    ))
                ) {
                  toast.error("اختار صورة PNG أو JPEG أو WebP أقل من 5 MB");
                  setReceipt(null);
                  return;
                }
                setReceipt(file);
              }}
            />
            {receipt && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <Private hidden={privacy}>{receipt.name}</Private>
              </p>
            )}
            {receiptPreview && (
              <img
                src={receiptPreview}
                alt="معاينة الوصل"
                className={`mt-2 max-h-36 rounded-md border border-zinc-200 dark:border-white/10 object-contain ${privacy ? "private-blur" : ""}`}
              />
            )}
          </div>
        </div>
        <DrawerFooter className="border-t border-zinc-100 dark:border-white/10">
          <Button
            onClick={() => {
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(spentAt) ||
                !Number.isFinite(Date.parse(`${spentAt}T12:00:00Z`))
              ) {
                toast.error("التاريخ غير صالح");
                return;
              }
              const id = newId();
              const replacement = {
                title, amount: toCents(amount), category, source, channel,
                memberId: source === "offset" ? memberId : undefined,
                mode, note,
                spentAt: new Date(`${spentAt}T12:00:00Z`).toISOString(),
                receiptId: receipt ? `receipt:${id}` : removeReceipt ? undefined : editingExpense?.receiptId,
              };
              const ok = dispatch(editingExpense
                ? { id, type: "correct_expense", adminId, targetId: editingExpense.id, expectedRevision, replacement, at: new Date().toISOString() }
                : { id, type: "expense", adminId, ...replacement }, receipt ?? undefined);
              if (ok) {
                onClose();
                setTitle("");
                setAmount("");
                setNote("");
                setReceipt(null);
              }
            }}
          >
            {editingExpense ? "حفظ التعديل" : "تسجيل المصروف"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function PassbookDrawer({
  state,
  member,
  month,
  privacy,
  adminId,
  dispatch,
  onClose,
}: {
  state: TreasuryState;
  member: Member | null;
  month: string;
  privacy: boolean;
  adminId: string;
  dispatch: Dispatch;
  onClose: () => void;
}) {
  const year = Number(month.slice(0, 4));
  const history = member
    ? state.payments.filter((p) => p.memberId === member.id)
    : [];
  const paid = history.filter((payment) => !payment.reversedAt);
  const lifetime = paid.reduce((sum, p) => sum + p.amount, 0);
  return (
    <Drawer
      open={!!member}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      direction="bottom"
    >
      <DrawerContent
        dir="rtl"
        className="mx-auto max-h-[85dvh] max-w-lg"
      >
        <DrawerHeader className="text-start">
          <DrawerTitle>
            <Private hidden={privacy}>{member?.name}</Private>
          </DrawerTitle>
          <DrawerDescription>دفتر المساهمات · <span className="numeric">{year}</span></DrawerDescription>
        </DrawerHeader>
        {member && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-6">
            <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">مجموع المساهمات</p>
              <p className="mt-1 text-xl font-semibold">
                <Amount value={lifetime} hidden={privacy} />
              </p>
              <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                متأخر بـ <span className="numeric">{arrearsFor(state, member, month).count}</span> شهر
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const target = `${year}-${String(i + 1).padStart(2, "0")}`;
                const status = statusFor(state, member.id, target);
                const outside =
                  target < member.joinedMonth || target > toMonth(new Date());
                return (
                  <div
                    key={target}
                    className="rounded-lg border border-zinc-200 dark:border-white/10 p-2 text-center"
                  >
                    <p className="text-xs font-medium">
                      {titleOf(target).split(" ")[0]}
                    </p>
                    <div className="mt-1">
                      {outside ? (
                        <Badge variant="outline">—</Badge>
                      ) : (
                        <StatusBadge status={status} />
                      )}
                    </div>
                    <p
                      className={`numeric mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 ${privacy ? "private-blur" : ""}`}
                    >
                      {outside ? "—" : money(paidFor(state, member.id, target))}
                    </p>
                  </div>
                );
              })}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">تاريخ الأداء</h3>
              <div className="divide-y divide-zinc-100 dark:divide-white/10 rounded-lg border border-zinc-200 dark:border-white/10">
                {history
                  .slice()
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                    >
                      <span>
                        <span className="numeric">
                          {p.occurredAt.slice(0, 10)}
                        </span>{" "}
                        ·{" "}
                        {p.source === "offset"
                          ? "مقاصة"
                          : p.source === "cash"
                            ? "كاش"
                            : "بنكة"}
                      </span>
                      <div className="flex items-center gap-1">
                        {p.reversedAt && <Badge variant="outline">مصَحح</Badge>}
                        {p.replacesId && <span className="text-[10px] text-zinc-500 dark:text-zinc-400">بديل</span>}
                        <Amount value={p.amount} hidden={privacy} />
                        {!p.reversedAt && <RecordActions state={state} payment={p} adminId={adminId} privacy={privacy} dispatch={dispatch} />}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">الإعفاءات</h3>
              <div className="divide-y divide-zinc-100 dark:divide-white/10 rounded-lg border border-zinc-200 dark:border-white/10">
                {state.waivers.filter((waiver) => waiver.memberId === member.id).map((waiver) => (
                  <div key={waiver.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="numeric">{waiver.month} {waiver.reversedAt ? "· مصَحح" : ""}</span>
                    {!waiver.reversedAt && <RecordActions state={state} waiver={waiver} adminId={adminId} privacy={privacy} dispatch={dispatch} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DrawerFooter><Button variant="outline" onClick={onClose}>إغلاق</Button></DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function WhatsAppDrawer({
  state,
  member,
  month,
  adminName,
  privacy,
  onClose,
}: {
  state: TreasuryState;
  member: Member | null;
  month: string;
  adminName: string;
  privacy: boolean;
  onClose: () => void;
}) {
  const initialKind = member
    ? ((() => {
        const status = statusFor(state, member.id, month);
        return status === "partial"
          ? "remaining"
          : status === "paid" || status === "bonus"
            ? "receipt"
            : arrearsFor(state, member, month).count
              ? "arrears"
              : "friendly";
      })() as Template)
    : "friendly";
  const [kind, setKind] = useState<Template>(initialKind);
  const [message, setMessage] = useState(
    member ? privateMessage(state, member, month, adminName, initialKind) : "",
  );
  const templates: Record<Template, string> = {
    friendly: "تذكير ودي",
    remaining: "تكملة الباقي",
    arrears: "المتأخرات",
    receipt: "توصيل الأداء",
  };
  return (
    <Drawer
      open={!!member}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      direction="bottom"
    >
      <DrawerContent
        dir="rtl"
        className="mx-auto max-h-[85dvh] max-w-lg"
      >
        <DrawerHeader className="text-start">
          <DrawerTitle>رسالة واتساب خاصة</DrawerTitle>
          <DrawerDescription>
            <Private hidden={privacy}>{member?.name}</Private> ·{" "}
            <Private hidden={privacy} className="numeric">
              {member?.phone}
            </Private>
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
          <Select
            value={kind}
            onValueChange={(value) => {
              const next = value as Template;
              setKind(next);
              if (member)
                setMessage(
                  privateMessage(state, member, month, adminName, next),
                );
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {Object.entries(templates).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={8}
            className={privacy ? "private-blur" : ""}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="نص الرسالة"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            غادي يتحل واتساب فالجهاز ديالك، وكتراجع الرسالة قبل الإرسال.
          </p>
        </div>
        <DrawerFooter>
          <Button
            onClick={() => {
              const url = member && whatsappUrl(member.phone, message);
              if (!url) {
                toast.error("رقم الهاتف غير صالح");
                return;
              }
              window.open(url, "_blank", "noopener,noreferrer");
              onClose();
            }}
          >
            <MessageCircle className="size-4" /> فتح واتساب
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function ReportDialog({
  state,
  month,
  open,
  onClose,
}: {
  state: TreasuryState;
  month: string;
  open: boolean;
  onClose: () => void;
}) {
  const report = useMemo(() => groupReport(state, month), [state, month]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[85dvh] max-w-lg"
      >
        <DialogHeader className="text-start">
          <DialogTitle>تقرير الكروب بلا سميات</DialogTitle>
          <DialogDescription>
            تقرير شفاف للمساهمات والمصاريف، بلا معلومات شخصية.
          </DialogDescription>
        </DialogHeader>
        <pre className="min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-sm leading-7 font-sans">
          {report}
        </pre>
        <DialogFooter>
          <Button
            onClick={() =>
              navigator.clipboard
                .writeText(report)
                .then(() => toast.success("تنسخ التقرير"))
            }
          >
            <Copy className="size-4" /> نسخ التقرير
          </Button>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
