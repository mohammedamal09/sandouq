"use client";

import { useState } from "react";
import { strToU8, zipSync } from "fflate";
import {
  Check,
  Download,
  FlaskConical,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addMonths,
  minimumFor,
  minimumRuleEditable,
  newId,
  toMonth,
  type Command,
  type Member,
  type TreasuryState,
} from "@/lib/domain";
import { exportCsvTables } from "@/lib/report";
import {
  filesFromBackup,
  makeBackup,
  parseBackup,
  restoreLocalBackup,
  type Backup,
} from "@/lib/backup";
import { normalizeMoroccanPhone } from "@/lib/whatsapp";
import { AdminManagement } from "./admin-management";
import { createSeed } from "@/lib/seed";

type Props = {
  state: TreasuryState;
  adminId: string;
  privacy: boolean;
  dispatch: (command: Command) => boolean;
  importLocal: (state: TreasuryState) => void;
  resetLocal: () => Promise<void>;
  cloudEnabled: boolean;
  createGroup: (
    name: string,
    adminName: string,
    pin: string,
    importData?: TreasuryState,
    receiptFiles?: Record<string, File>,
  ) => Promise<string>;
};
const cents = (value: string) =>
  Math.round(Number(value.replace(",", ".")) * 100);
const saveBlob = (name: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function SettingsPanel({
  state,
  adminId,
  privacy,
  dispatch,
  importLocal,
  resetLocal,
  cloudEnabled,
  createGroup,
}: Props) {
  const [minimum, setMinimum] = useState(
    String(minimumFor(state, toMonth(new Date())) / 100),
  );
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberJoinMonth, setMemberJoinMonth] = useState(toMonth(new Date()));
  const [editing, setEditing] = useState<Member | null>(null);
  const [showArchivedMembers, setShowArchivedMembers] = useState(false);
  const [ruleAmounts, setRuleAmounts] = useState<Record<string, string>>({});
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [importName, setImportName] = useState("صندوق مستورد");
  const [importAdmin, setImportAdmin] = useState("");
  const [importPin, setImportPin] = useState("");
  const [importCode, setImportCode] = useState("");
  const nextMonth = addMonths(toMonth(new Date()), 1);
  async function readImport(file?: File) {
    if (!file) return;
    try {
      setPendingImport(parseBackup(JSON.parse(await file.text())));
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  function submitMember() {
    const phone = normalizeMoroccanPhone(editing?.phone ?? memberPhone);
    if (!phone) {
      toast.error("رقم مغربي غير صالح");
      return;
    }
    const member: Member = editing
      ? { ...editing, phone, name: editing.name.trim() }
      : {
          id: newId(),
          name: memberName.trim(),
          phone,
          joinedMonth: memberJoinMonth,
          active: true,
          revision: 0,
          accessPin: String(Math.floor(1000 + Math.random() * 9000)),
        };
    if (
      dispatch({
        id: newId(),
        type: "member",
        adminId,
        member,
        expectedRevision: editing?.revision,
        at: new Date().toISOString(),
      })
    ) {
      setEditing(null);
      setMemberName("");
      setMemberPhone("");
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold">الإعدادات والنسخ الاحتياطي</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          تدبير الأعضاء والمشرفين والبيانات
        </p>
      </div>
      <section className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">الحد الأدنى الشهري</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          التغيير كيبدأ من {nextMonth}، والشهور اللي فاتت كيبقاو كيف ما كانو.
        </p>
        <div className="flex gap-2">
          <Input
            className="numeric text-start"
            type="number"
            min="1"
            step="0.01"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
            aria-label="الحد الأدنى الجديد بالدرهم"
          />
          <Button
            onClick={() =>
              dispatch({
                id: newId(),
                type: "minimum",
                adminId,
                amount: cents(minimum),
                effectiveMonth: nextMonth,
                expectedRevision: state.revision,
                at: new Date().toISOString(),
              })
            }
          >
            حفظ
          </Button>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-white/10 rounded-lg border border-zinc-200 dark:border-white/10">
          {[...state.minimums]
            .sort((a, b) => b.month.localeCompare(a.month))
            .map((rule) => {
              const editable = minimumRuleEditable(state, rule.month);
              return (
                <div
                  key={rule.month}
                  className="flex flex-wrap items-center gap-2 p-2.5 text-xs"
                >
                  <span className="numeric w-20 font-medium">{rule.month}</span>
                  <Input
                    className="numeric max-w-28 text-start"
                    type="number"
                    min="1"
                    step="0.01"
                    disabled={!editable}
                    value={ruleAmounts[rule.month] ?? String(rule.amount / 100)}
                    onChange={(event) =>
                      setRuleAmounts({
                        ...ruleAmounts,
                        [rule.month]: event.target.value,
                      })
                    }
                    aria-label={`الحد الأدنى لشهر ${rule.month}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editable}
                    onClick={() =>
                      dispatch({
                        id: newId(),
                        type: "minimum_rule",
                        adminId,
                        month: rule.month,
                        amount: cents(
                          ruleAmounts[rule.month] ?? String(rule.amount / 100),
                        ),
                        expectedRevision: state.revision,
                        at: new Date().toISOString(),
                      })
                    }
                  >
                    حفظ
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!editable}
                        className="text-rose-600"
                      >
                        حذف
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          حذف قاعدة الحد الأدنى
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          غادي ترجع الشهور الجاية للقاعدة السابقة. واش متأكد؟
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline">إلغاء</Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() =>
                              dispatch({
                                id: newId(),
                                type: "minimum_rule",
                                adminId,
                                month: rule.month,
                                expectedRevision: state.revision,
                                at: new Date().toISOString(),
                              })
                            }
                          >
                            حذف
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {!editable && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      شهر مغلق أو فيه أداء/إعفاء
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </section>
      <section className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">الأعضاء</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowArchivedMembers(!showArchivedMembers)}
        >
          {showArchivedMembers ? "إخفاء المؤرشفين" : "عرض المؤرشفين"}
        </Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className={privacy ? "private-blur" : ""}
            placeholder="اسم العضو"
            value={editing?.name ?? memberName}
            onChange={(e) =>
              editing
                ? setEditing({ ...editing, name: e.target.value })
                : setMemberName(e.target.value)
            }
          />
          <Input
            className={`numeric text-start ${privacy ? "private-blur" : ""}`}
            placeholder="06… أو +212…"
            value={editing?.phone ?? memberPhone}
            onChange={(e) =>
              editing
                ? setEditing({ ...editing, phone: e.target.value })
                : setMemberPhone(e.target.value)
            }
          />
          <div className="space-y-1">
            <label
              className="text-xs text-zinc-600 dark:text-zinc-300"
              htmlFor="member-joined-month"
            >
              شهر الانضمام
            </label>
            <Input
              id="member-joined-month"
              className="numeric"
              type="month"
              dir="ltr"
              value={editing?.joinedMonth ?? memberJoinMonth}
              onChange={(e) =>
                editing
                  ? setEditing({ ...editing, joinedMonth: e.target.value })
                  : setMemberJoinMonth(e.target.value)
              }
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={submitMember}>
            <Plus className="size-4" /> {editing ? "حفظ العضو" : "إضافة عضو"}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => setEditing(null)}>
              إلغاء
            </Button>
          )}
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-white/10 rounded-lg border border-zinc-200 dark:border-white/10">
          {state.members
            .filter((member) => showArchivedMembers || !member.archivedAt)
            .map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-2 p-2.5 text-xs"
              >
                <span className={privacy ? "private-blur" : ""}>
                  {member.name}{" "}
                  <span className="numeric text-zinc-500 dark:text-zinc-400">
                    {member.phone}
                  </span>
                </span>
                <div className="flex gap-1">
                  {member.archivedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        dispatch({
                          id: newId(),
                          type: "member",
                          adminId,
                          member: {
                            ...member,
                            archivedAt: undefined,
                            active: true,
                          },
                          expectedRevision: member.revision,
                          at: new Date().toISOString(),
                        })
                      }
                    >
                      استرجاع
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(member)}
                  >
                    تعديل
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 dark:text-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                        aria-label={`حذف ${member.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف العضو</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل أنت متأكد؟ العضو اللي عنده سجل مالي غادي يتأرشف
                          وتبقى مساهماته محفوظة.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline">إلغاء</Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              if (
                                dispatch({
                                  id: newId(),
                                  type: "delete_member",
                                  adminId,
                                  memberId: member.id,
                                  at: new Date().toISOString(),
                                })
                              )
                                toast.success(
                                  "تم حذف العضو أو أرشفته مع الحفاظ على سجله",
                                );
                            }}
                          >
                            حذف العضو
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {!member.archivedAt && (
                    <label className="flex items-center gap-1.5">
                      <Switch
                        checked={member.active}
                        onCheckedChange={(checked) =>
                          dispatch({
                            id: newId(),
                            type: "member",
                            adminId,
                            member: { ...member, active: checked },
                            expectedRevision: member.revision,
                            at: new Date().toISOString(),
                          })
                        }
                        aria-label={`تفعيل ${member.name}`}
                      />
                      <span>{member.active ? "نشط" : "موقوف"}</span>
                    </label>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>
      <AdminManagement
        state={state}
        adminId={adminId}
        privacy={privacy}
        dispatch={dispatch}
      />
      <section className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">أدوات الصندوق</h3>
        <p className="text-xs text-muted-foreground">
          بيانات التجربة كتكون غير فهاد الجهاز. التصفير كيرجع الصندوق لمساحة
          نظيفة فيها غير الحد الأدنى الافتراضي.
        </p>
        <div className="flex flex-wrap gap-2">
          {!cloudEnabled && (
            <Button
              variant="outline"
              onClick={() => {
                importLocal(createSeed());
                toast.success("تحملات بيانات تجريبية فهاد الجهاز");
              }}
            >
              <FlaskConical className="size-4" /> تحميل بيانات تجريبية
            </Button>
          )}
          {!cloudEnabled && (
            <Button
              variant="destructive"
              data-testid="reset-local-treasury"
              onClick={() =>
                void resetLocal()
                  .then(() => toast.success("تصفّر الصندوق وبدا بمساحة نظيفة"))
                  .catch((error) => toast.error((error as Error).message))
              }
            >
              <RotateCcw className="size-4" /> تصفير الصندوق للبدء بالبيانات
              الحقيقية
            </Button>
          )}
        </div>
      </section>
      <section className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">النسخ والتحميل</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          JSON كيتضمن جميع البيانات، وCSV ملف ZIP فيه الجداول الأساسية.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void makeBackup(state)
                .then((backup) =>
                  saveBlob(
                    `sandouq-${toMonth(new Date())}.json`,
                    new Blob([JSON.stringify(backup, null, 2)], {
                      type: "application/json",
                    }),
                  ),
                )
                .catch((error) => toast.error(error.message));
            }}
          >
            <Download className="size-4" /> تصدير JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const entries = Object.fromEntries(
                Object.entries(exportCsvTables(state)).map(
                  ([name, content]) => [name, strToU8(content)],
                ),
              );
              const zip = zipSync(entries);
              saveBlob(
                `sandouq-${toMonth(new Date())}-csv.zip`,
                new Blob([Uint8Array.from(zip)], { type: "application/zip" }),
              );
            }}
          >
            <Download className="size-4" /> تصدير CSV
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 dark:border-white/10 px-3 py-2 text-sm">
            <Upload className="size-4" /> استيراد JSON
            <input
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(e) => void readImport(e.target.files?.[0])}
            />
          </label>
        </div>
        {pendingImport && (
          <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs">
            <p>
              الملف فيه {pendingImport.state.members.length} أعضاء،{" "}
              {pendingImport.state.payments.length} مساهمات، و
              {pendingImport.state.expenses.length} مصاريف.{" "}
              {cloudEnabled
                ? "الاستيراد غادي ينشئ مجموعة سحابية جديدة."
                : "الاستيراد غادي يعوض البيانات المحلية الحالية."}
            </p>
            {cloudEnabled && (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="اسم المجموعة الجديدة"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                />
                <Input
                  placeholder="اسم المشرف الجديد"
                  value={importAdmin}
                  onChange={(e) => setImportAdmin(e.target.value)}
                />
                <Input
                  className="numeric text-start"
                  placeholder="رمز شخصي من 6 أرقام"
                  type="password"
                  maxLength={6}
                  value={importPin}
                  onChange={(e) => setImportPin(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!pendingImport) return;
                  if (cloudEnabled)
                    void filesFromBackup(pendingImport)
                      .then((files) =>
                        createGroup(
                          importName,
                          importAdmin,
                          importPin,
                          pendingImport.state,
                          files,
                        ),
                      )
                      .then((code) => {
                        setImportCode(code);
                        setPendingImport(null);
                        toast.success("تنشأت المجموعة الجديدة");
                      })
                      .catch((error) => toast.error(error.message));
                  else {
                    void restoreLocalBackup(pendingImport)
                      .then((restored) => {
                        importLocal(restored);
                        setPendingImport(null);
                        toast.success("ترجعات البيانات");
                      })
                      .catch((error) => toast.error(error.message));
                  }
                }}
              >
                <Check className="size-4" /> تأكيد الاستيراد
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingImport(null)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}
        {importCode && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs">
            <p>رمز المجموعة الجديدة — احتافظ به وشاركو غير مع المشرفين:</p>
            <p className="numeric mt-1 select-all break-all font-semibold">
              {importCode}
            </p>
          </div>
        )}
      </section>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {cloudEnabled
          ? "المزامنة السحابية مفعلة على هاد الجهاز."
          : "نسخة محلية تجريبية، البيانات محفوظة فهاد المتصفح."}
      </p>
    </div>
  );
}
