"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TreasuryState } from "@/lib/domain";
import { ThemeToggle } from "./theme-toggle";

export function CloudSetup({
  createGroup,
  lookupGroup,
  joinGroup,
  error,
}: {
  createGroup: (
    name: string,
    adminName: string,
    pin: string,
    importData?: TreasuryState,
  ) => Promise<string>;
  lookupGroup: (
    code: string,
  ) => Promise<{ groupName: string; admins: { id: string; name: string }[] }>;
  joinGroup: (code: string, adminId: string, pin: string) => Promise<void>;
  error: string;
}) {
  const [mode, setMode] = useState<"create" | "join">("join");
  const [name, setName] = useState("صندوق المجموعة");
  const [adminName, setAdminName] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [adminId, setAdminId] = useState("");
  const [found, setFound] = useState<{
    groupName: string;
    admins: { id: string; name: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function perform(task: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (cause) {
      setMessage((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute end-4 top-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/70 shadow-xs">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Wallet className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">صندوق المجموعة</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                مساحة جماعية آمنة للمساهمات والمصاريف
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === "join" ? "default" : "outline"}
              onClick={() => setMode("join")}
            >
              دخول للمجموعة
            </Button>
            <Button
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => setMode("create")}
            >
              مجموعة جديدة
            </Button>
          </div>
          {mode === "create" ? (
            <>
              <div>
                <Label htmlFor="group-name">اسم المجموعة</Label>
                <Input
                  id="group-name"
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="admin-name">سميتك كمشرف</Label>
                <Input
                  id="admin-name"
                  className="mt-2"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="create-pin">رمز شخصي من 6 أرقام</Label>
                <Input
                  id="create-pin"
                  className="numeric mt-2 text-start"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
              <Button
                disabled={busy}
                className="w-full"
                onClick={() =>
                  void perform(() => createGroup(name, adminName, pin))
                }
              >
                إنشاء الصندوق
              </Button>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="group-code">رمز المجموعة</Label>
                <Input
                  id="group-code"
                  className="numeric mt-2 text-start"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.trim());
                    setFound(null);
                  }}
                  placeholder="SND-…"
                />
              </div>
              <Button
                disabled={busy || !code}
                variant="outline"
                className="w-full"
                onClick={() =>
                  void perform(async () => {
                    const result = await lookupGroup(code);
                    setFound(result);
                    setAdminId(result.admins[0]?.id ?? "");
                  })
                }
              >
                البحث عن المجموعة
              </Button>
              {found && (
                <>
                  <p className="text-sm font-semibold">{found.groupName}</p>
                  <div>
                    <Label>المشرف</Label>
                    <Select value={adminId} onValueChange={setAdminId}>
                      <SelectTrigger className="mt-2 w-full">
                        <SelectValue placeholder="اختار المشرف" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        {found.admins.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="join-pin">الرمز الشخصي</Label>
                    <Input
                      id="join-pin"
                      className="numeric mt-2 text-start"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                    />
                  </div>
                  <Button
                    disabled={busy || !adminId}
                    className="w-full"
                    onClick={() =>
                      void perform(() => joinGroup(code, adminId, pin))
                    }
                  >
                    دخول
                  </Button>
                </>
              )}
            </>
          )}
          {(message || error) && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300"
            >
              {message || error}
            </p>
          )}
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            الرمز الجماعي كيدخل للمجموعة، والرمز الشخصي كيثبت اسم المشرف على هاد
            الجهاز.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
