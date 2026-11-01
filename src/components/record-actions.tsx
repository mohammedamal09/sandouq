"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { allocationPreview, money, newId, type AllocationMode, type Channel, type Command, type Payment, type TreasuryState, type Waiver } from "@/lib/domain";
import { Private } from "./display";

export function RecordActions({ state, payment, waiver, adminId, privacy, dispatch }: {
  state: TreasuryState; payment?: Payment; waiver?: Waiver; adminId: string; privacy: boolean;
  dispatch: (command: Command) => boolean;
}) {
  const record = payment ?? waiver;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [expectedRevision, setExpectedRevision] = useState(state.revision);
  const [memberId, setMemberId] = useState(record?.memberId ?? "");
  const [month, setMonth] = useState(payment?.selectedMonth ?? payment?.allocations[0]?.month ?? waiver?.month ?? "");
  const [amount, setAmount] = useState(payment ? String(payment.amount / 100) : "");
  const [channel, setChannel] = useState<Channel>(payment?.source === "bank" ? "bank" : "cash");
  const [mode, setMode] = useState<AllocationMode>(payment?.mode ?? (payment?.allocations.some((part) => part.month !== payment.allocations[0]?.month) ? "prepay" : "bonus"));
  const [date, setDate] = useState(payment?.occurredAt.slice(0, 10) ?? "");
  const offset = Boolean(payment?.expenseId);
  if (!record) return null;
  const openEditor = () => {
    setFormError("");
    setExpectedRevision(state.revision);
    setMemberId(record.memberId);
    setMonth(payment?.selectedMonth ?? payment?.allocations[0]?.month ?? waiver?.month ?? "");
    setAmount(payment ? String(payment.amount / 100) : "");
    setChannel(payment?.source === "bank" ? "bank" : "cash");
    setMode(payment?.mode ?? (payment?.allocations.some((part) => part.month !== payment.allocations[0]?.month) ? "prepay" : "bonus"));
    setDate(payment?.occurredAt.slice(0, 10) ?? "");
    setEditOpen(true);
  };
  let preview = "";
  if (payment && !offset) {
    try {
      const copy = structuredClone(state);
      const original = copy.payments.find((item) => item.id === payment.id);
      if (original) original.reversedAt = new Date().toISOString();
      const parts = allocationPreview(copy, memberId, month, Math.round(Number(amount) * 100), mode, true);
      preview = parts.map((part) => `${part.month}: ${money(part.base + part.bonus)}`).join(" · ");
    } catch { preview = ""; }
  }
  const correct = (remove: boolean) => {
    if (payment && !remove && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`)))) {
      setFormError("تاريخ الأداء غير صالح");
      return false;
    }
    const id = newId();
    const at = new Date().toISOString();
    const command: Command = payment
      ? { id, type: "correct_payment", adminId, targetId: payment.id, expectedRevision,
          replacement: remove ? undefined : { memberId, month, amount: Math.round(Number(amount) * 100), channel, mode, occurredAt: new Date(`${date}T12:00:00Z`).toISOString() }, at }
      : { id, type: "correct_waiver", adminId, targetId: waiver!.id, expectedRevision,
          replacement: remove ? undefined : { memberId, month }, at };
    if (dispatch(command)) { setEditOpen(false); setDeleteOpen(false); return true; }
    return false;
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="خيارات السجل"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={offset || Boolean(record.reversedAt)} onSelect={openEditor}>تعديل</DropdownMenuItem>
          <DropdownMenuItem disabled={offset || Boolean(record.reversedAt)} className="text-rose-700 dark:text-rose-300" onSelect={() => { setExpectedRevision(state.revision); setDeleteOpen(true); }}>حذف</DropdownMenuItem>
          {offset && <p className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">صحح المصروف المرتبط بالمقاصة</p>}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader className="text-start"><DialogTitle>{payment ? "تعديل المساهمة" : "تعديل الإعفاء"}</DialogTitle><DialogDescription>التعديل يحفظ السجل القديم في التاريخ.</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
            <div><Label>العضو</Label><Select value={memberId} onValueChange={setMemberId}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent dir="rtl">{state.members.filter((member) => member.active || member.id === memberId).map((member) => <SelectItem key={member.id} value={member.id}><Private hidden={privacy}>{member.name}</Private></SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor={`record-month-${record.id}`}>الشهر</Label><Input id={`record-month-${record.id}`} className="numeric mt-2" type="month" dir="ltr" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
            {payment && <>
              <div><Label htmlFor={`record-amount-${record.id}`}>المبلغ (DH)</Label><Input id={`record-amount-${record.id}`} className={`numeric mt-2 text-start ${privacy ? "private-blur" : ""}`} type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
              <div><Label htmlFor={`record-date-${record.id}`}>تاريخ الأداء</Label><Input id={`record-date-${record.id}`} className="numeric mt-2" type="date" dir="ltr" value={date} onChange={(event) => setDate(event.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2"><Button variant={channel === "cash" ? "default" : "outline"} onClick={() => setChannel("cash")}>كاش</Button><Button variant={channel === "bank" ? "default" : "outline"} onClick={() => setChannel("bank")}>بنكة</Button></div>
              <div className="grid grid-cols-2 gap-2"><Button variant={mode === "bonus" ? "secondary" : "outline"} onClick={() => setMode("bonus")}>فوق الخير</Button><Button variant={mode === "prepay" ? "secondary" : "outline"} onClick={() => setMode("prepay")}>تسبيق</Button></div>
              {preview && <p className="numeric rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-2 text-xs">{preview}</p>}
            </>}
            {formError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{formError}</p>}
          </div>
          <DialogFooter><Button onClick={() => correct(false)}>حفظ التعديل</Button><Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف السجل</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد؟ غادي يبقى السجل الأصلي ظاهر في التاريخ كمصحح.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">إلغاء</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={(event) => { if (!correct(true)) event.preventDefault(); }}>حذف</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
