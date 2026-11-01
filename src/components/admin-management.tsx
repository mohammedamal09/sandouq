"use client";

import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newId, type Admin, type Command, type TreasuryState } from "@/lib/domain";
import { Private } from "./display";

export function AdminManagement({ state, adminId, privacy, dispatch }: {
  state: TreasuryState; adminId: string; privacy: boolean; dispatch: (command: Command) => boolean;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Admin | null>(null);
  const [formError, setFormError] = useState("");
  const openForm = (admin?: Admin) => {
    setEditing(admin ?? null); setName(admin?.name ?? ""); setPin(""); setFormError(""); setDialogOpen(true);
  };
  const submit = () => {
    if (!name.trim() || name.trim().length > 80) return setFormError("دخل اسم المشرف (حتى 80 حرف)");
    if ((!editing && !/^\d{6}$/.test(pin)) || (editing && pin && !/^\d{6}$/.test(pin)))
      return setFormError("الرمز الشخصي خاصو يكون 6 أرقام");
    const at = new Date().toISOString();
    const command: Command = editing
      ? { id: newId(), type: "admin_edit", adminId, targetId: editing.id, name: name.trim(), pin: pin || undefined, expectedRevision: state.revision, at }
      : { id: newId(), type: "admin", adminId, admin: { id: newId(), name: name.trim(), pin, active: true }, at };
    if (dispatch(command)) setDialogOpen(false);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>إدارة المشرفين</CardTitle>
        <Button size="sm" variant="outline" onClick={() => openForm()}><Plus className="size-4" /> إضافة مشرف جديد</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" variant="ghost" onClick={() => setShowArchived(!showArchived)}>{showArchived ? "إخفاء المؤرشفين" : "عرض المؤرشفين"}</Button>
        <div className="divide-y divide-zinc-100 dark:divide-white/10 rounded-lg border border-zinc-200 dark:border-white/10">
          {state.admins.filter((admin) => showArchived || !admin.archivedAt).map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 p-3">
              <Avatar size="sm" className="bg-zinc-100 dark:bg-zinc-800"><AvatarFallback><Private hidden={privacy}>{admin.name.slice(0, 2)}</Private></AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold"><Private hidden={privacy}>{admin.name}</Private></p><div className="mt-1 flex gap-1"><Badge variant="outline">مشرف</Badge><Badge variant={admin.archivedAt ? "outline" : admin.active ? "secondary" : "outline"}>{admin.archivedAt ? "مؤرشف" : admin.active ? "نشط" : "موقوف"}</Badge></div></div>
              <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`خيارات ${admin.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                {!admin.archivedAt && <DropdownMenuItem onSelect={() => openForm(admin)}>تعديل الاسم أو الرمز</DropdownMenuItem>}
                {!admin.archivedAt && admin.id !== adminId && <DropdownMenuItem onSelect={() => dispatch({ id: newId(), type: "admin_status", adminId, targetId: admin.id, active: !admin.active, at: new Date().toISOString() })}>{admin.active ? "إيقاف" : "تنشيط"}</DropdownMenuItem>}
                {admin.archivedAt ? <DropdownMenuItem onSelect={() => dispatch({ id: newId(), type: "admin_archive", adminId, targetId: admin.id, archived: false, expectedRevision: state.revision, at: new Date().toISOString() })}>استرجاع</DropdownMenuItem> : admin.id !== adminId && <DropdownMenuItem className="text-rose-700 dark:text-rose-300" onSelect={() => setArchiveTarget(admin)}>حذف</DropdownMenuItem>}
              </DropdownMenuContent></DropdownMenu>
            </div>
          ))}
        </div>
      </CardContent>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm"><DialogHeader className="text-start"><DialogTitle>{editing ? "تعديل المشرف" : "إضافة مشرف جديد"}</DialogTitle><DialogDescription>{editing ? "اترك الرمز فارغا للاحتفاظ به." : "الرمز الشخصي يتكون من 6 أرقام."}</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain"><div><Label htmlFor="admin-name">الاسم</Label><Input id="admin-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></div><div><Label htmlFor="admin-pin">الرمز الشخصي</Label><Input id="admin-pin" className="numeric mt-2 text-start" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} /></div>{formError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{formError}</p>}</div>
          <DialogFooter><Button onClick={submit}>حفظ</Button><Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>أرشفة المشرف</AlertDialogTitle><AlertDialogDescription>غادي يتوقف دخول هذا المشرف، وتبقى عملياته السابقة ظاهرة في السجل.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">إلغاء</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={() => { if (archiveTarget) dispatch({ id: newId(), type: "admin_archive", adminId, targetId: archiveTarget.id, archived: true, expectedRevision: state.revision, at: new Date().toISOString() }); setArchiveTarget(null); }}>أرشفة</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </Card>
  );
}
