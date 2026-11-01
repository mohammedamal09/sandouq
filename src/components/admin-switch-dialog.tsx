"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function AdminSwitchDialog({
  name,
  open,
  onClose,
  onVerify,
}: {
  name: string;
  open: boolean;
  onClose: () => void;
  onVerify: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await onVerify(pin);
      setPin("");
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setPin("");
          onClose();
        }
      }}
    >
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>تغيير المشرف</DialogTitle>
          <DialogDescription>دخل الرمز الشخصي ديال {name}</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="switch-pin">الرمز الشخصي</Label>
          <Input
            id="switch-pin"
            className="numeric mt-2 text-start"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || pin.length !== 6}
            onClick={() => void submit()}
          >
            تأكيد
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
