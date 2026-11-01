"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { del, get, keys, set } from "idb-keyval";
import { applyCommand, type Command, type TreasuryState } from "./domain";
import { createCleanLocalState, loadLocal, saveLocal } from "./storage";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const cloudEnabled = Boolean(url && key);
const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
type Snapshot = { state: TreasuryState; adminId: string; groupId: string };
type Queued = { command: Command; receipt?: File };
const snapshotKey = "sandouq:cloud:snapshot";
const queueKey = "sandouq:cloud:queue";
async function api(method: "GET" | "POST", body?: unknown) {
  if (!supabase) throw new Error("Supabase غير مهيأ");
  let { data } = await supabase.auth.getSession();
  if (!data.session) {
    const signed = await supabase.auth.signInAnonymously();
    if (signed.error) throw signed.error;
    data = { session: signed.data.session };
  }
  const response = await fetch("/api/cloud", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token}`,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "تعذر الاتصال بالسيرفر");
  return result;
}
export function useTreasury() {
  const [state, setState] = useState<TreasuryState | null>(null);
  const [adminId, setAdminId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [pendingItems, setPendingItems] = useState<
    { id: string; type: Command["type"] }[]
  >([]);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "offline" | "connecting" | "connected" | "error"
  >("offline");
  const stateRef = useRef<TreasuryState | null>(null);
  const syncing = useRef(false);
  const enqueueLock = useRef<Promise<void>>(Promise.resolve());
  const groupRef = useRef("");
  const update = useCallback((next: TreasuryState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const applySnapshot = useCallback(
    async (snapshot: Snapshot) => {
      const saved = await get<Snapshot>(snapshotKey);
      if (
        saved?.groupId === snapshot.groupId &&
        saved.state.revision > snapshot.state.revision
      )
        return;
      groupRef.current = snapshot.groupId;
      setGroupId(snapshot.groupId);
      setAdminId(snapshot.adminId);
      let visible = snapshot.state;
      const queue = (await get<Queued[]>(queueKey)) ?? [];
      for (const item of queue) {
        try {
          visible = applyCommand(visible, item.command);
        } catch {
          setError("كاين تعديل خاصو المراجعة قبل المزامنة");
          break;
        }
      }
      setPending(queue.length);
      setPendingItems(
        queue.map(({ command }) => ({ id: command.id, type: command.type })),
      );
      update(visible);
      await set(snapshotKey, snapshot);
    },
    [update],
  );
  const sync = useCallback(async () => {
    if (
      !cloudEnabled ||
      syncing.current ||
      !navigator.onLine ||
      !groupRef.current
    )
      return;
    syncing.current = true;
    try {
      let queue = (await get<Queued[]>(queueKey)) ?? [];
      while (queue.length) {
        const item = queue[0];
        let command = item.command;
        if (
          item.receipt &&
          supabase &&
          (command.type === "expense" ||
            command.type === "receipt" ||
            command.type === "correct_expense")
        ) {
          const safeName = item.receipt.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const expenseId =
            command.type === "receipt" ? command.expenseId : command.id;
          const path = `${groupRef.current}/${expenseId}/${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("sandouq-receipts")
            .upload(path, item.receipt, {
              upsert: true,
              contentType: item.receipt.type,
            });
          if (uploadError) throw uploadError;
          command =
            command.type === "correct_expense"
              ? {
                  ...command,
                  replacement: {
                    ...command.replacement!,
                    receiptId: `receipt:${path}`,
                  },
                }
              : { ...command, receiptId: `receipt:${path}` };
        }
        const response = await api("POST", { action: "command", command });
        queue = queue.slice(1);
        await set(queueKey, queue);
        setPending(queue.length);
        setPendingItems(
          queue.map(({ command }) => ({ id: command.id, type: command.type })),
        );
        const snapshot: Snapshot = {
          state: response.state,
          adminId: response.adminId,
          groupId: groupRef.current,
        };
        await applySnapshot(snapshot);
      }
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      syncing.current = false;
    }
  }, [applySnapshot]);
  const refreshFromCloud = useCallback(async () => {
    if (!cloudEnabled || !navigator.onLine || !groupRef.current) return;
    try {
      const remote = await api("GET");
      if (remote.joined)
        await applySnapshot({
          state: remote.state as TreasuryState,
          adminId: remote.adminId as string,
          groupId: remote.groupId as string,
        });
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [applySnapshot]);
  useEffect(() => {
    let alive = true;
    async function init() {
      if (!cloudEnabled) {
        const local = loadLocal();
        update(local);
        setAdminId(localStorage.getItem("sandouq:admin") ?? local.admins[0].id);
        setLoading(false);
        return;
      }
      try {
        const existingSession = await supabase!.auth.getSession();
        if (!existingSession.data.session) {
          await del(snapshotKey);
          await del(queueKey);
        }
        const cached = existingSession.data.session
          ? await get<Snapshot>(snapshotKey)
          : undefined;
        if (cached && alive) await applySnapshot(cached);
        const remote = await api("GET");
        if (remote.joined && alive) {
          await applySnapshot(remote);
          void sync();
        } else if (
          alive &&
          cached &&
          ((await get<Queued[]>(queueKey))?.length ?? 0) > 0
        ) {
          setError(
            "صلاحية المشرف تبدلات. راجع العمليات المعلقة أو احذفها، ثم بدل المشرف.",
          );
        } else if (alive) {
          stateRef.current = null;
          setState(null);
          setAdminId("");
          setGroupId("");
          groupRef.current = "";
          setPending(0);
          setPendingItems([]);
          await del(snapshotKey);
          await del(queueKey);
        }
      } catch (cause) {
        if (alive) setError((cause as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void init();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      alive = false;
      window.removeEventListener("online", online);
    };
  }, [applySnapshot, sync, update]);
  useEffect(() => {
    if (!supabase || !groupId) return;
    let refreshTimer: number | undefined;
    const channel = supabase
      .channel(`sandouq-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_state",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          // Financial records are committed together in group_state. Refetching the
          // snapshot keeps every selector and tab on the same revision, while
          // applySnapshot safely reapplies this device's still-pending commands.
          if (refreshTimer) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void refreshFromCloud(), 120);
        },
      )
      .subscribe((status) => {
        setRealtimeStatus(
          status === "SUBSCRIBED"
            ? "connected"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "error"
              : "connecting",
        );
      });
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      setRealtimeStatus("offline");
      void supabase.removeChannel(channel);
    };
  }, [groupId, refreshFromCloud]);
  const dispatch = useCallback(
    (command: Command, receipt?: File): boolean => {
      const previous = stateRef.current;
      if (!previous) return false;
      try {
        if (!cloudEnabled) {
          const next = applyCommand(previous, command);
          update(next);
          saveLocal(next);
          if (receipt) void set(`sandouq:receipt:${command.id}`, receipt);
          return true;
        }
        if (
          ["admin", "admin_status", "admin_edit", "admin_archive"].includes(
            command.type,
          ) &&
          !navigator.onLine
        )
          throw new Error("تغيير المشرفين خاصو اتصال بالإنترنت");
        if (
          ["admin", "admin_status", "admin_edit", "admin_archive"].includes(
            command.type,
          )
        ) {
          if (pending || syncing.current)
            throw new Error("زامن العمليات المعلقة قبل تغيير المشرفين");
          void api("POST", { action: "command", command })
            .then((response) =>
              applySnapshot({
                state: response.state as TreasuryState,
                adminId: response.adminId,
                groupId: groupRef.current,
              }),
            )
            .catch((cause) => setError((cause as Error).message));
          return true;
        }
        const next = applyCommand(previous, command);
        update(next);
        if (receipt) void set(`sandouq:receipt:${command.id}`, receipt);
        enqueueLock.current = enqueueLock.current
          .then(async () => {
            const queue = (await get<Queued[]>(queueKey)) ?? [];
            if (command.type === "undo" && !syncing.current) {
              const index = queue.findIndex(
                (item) => item.command.id === command.entityId,
              );
              if (index >= 0) {
                queue.splice(index, 1);
                await set(queueKey, queue);
                await del(`sandouq:receipt:${command.entityId}`);
                setPending(queue.length);
                setPendingItems(
                  queue.map(({ command }) => ({
                    id: command.id,
                    type: command.type,
                  })),
                );
                const cached = await get<Snapshot>(snapshotKey);
                if (cached) await applySnapshot(cached);
                return;
              }
            }
            queue.push({ command, receipt });
            await set(queueKey, queue);
            setPending(queue.length);
            setPendingItems(
              queue.map(({ command }) => ({
                id: command.id,
                type: command.type,
              })),
            );
            await sync();
          })
          .catch(async (cause) => {
            setError((cause as Error).message);
            const cached = await get<Snapshot>(snapshotKey);
            if (cached) await applySnapshot(cached);
          });
        return true;
      } catch (cause) {
        setError((cause as Error).message);
        return false;
      }
    },
    [applySnapshot, pending, sync, update],
  );
  const switchAdmin = useCallback(
    async (targetId: string, pin: string) => {
      if (!cloudEnabled) {
        const target = stateRef.current?.admins.find((a) => a.id === targetId);
        if (
          !target ||
          !target.active ||
          target.archivedAt ||
          target.pin !== pin
        )
          throw new Error("رمز المشرف غير صحيح");
        setAdminId(targetId);
        localStorage.setItem("sandouq:admin", targetId);
        return;
      }
      if (!navigator.onLine)
        throw new Error("تغيير المشرف خاصو اتصال بالإنترنت");
      if (pending) throw new Error("تسنى حتى تكمل مزامنة العمليات");
      const result = await api("POST", {
        action: "switch",
        adminId: targetId,
        pin,
      });
      await applySnapshot(result);
    },
    [applySnapshot, pending],
  );
  const createGroup = useCallback(
    async (
      name: string,
      adminName: string,
      pin: string,
      importData?: TreasuryState,
      receiptFiles?: Record<string, File>,
    ) => {
      if (pending)
        throw new Error("زامن العمليات المعلقة قبل إنشاء مجموعة جديدة");
      const result = await api("POST", {
        action: "create",
        name,
        adminName,
        pin,
        importData,
      });
      await del(queueKey);
      await applySnapshot(result);
      for (const [expenseId, file] of Object.entries(receiptFiles ?? {})) {
        const commandId = crypto.randomUUID();
        dispatch(
          {
            id: commandId,
            type: "receipt",
            adminId: result.adminId,
            expenseId,
            receiptId: `receipt:${commandId}`,
            at: new Date().toISOString(),
          },
          file,
        );
      }
      return result.code as string;
    },
    [applySnapshot, dispatch, pending],
  );
  const lookupGroup = useCallback(
    async (code: string) =>
      api("POST", { action: "lookup", code }) as Promise<{
        groupName: string;
        admins: { id: string; name: string }[];
      }>,
    [],
  );
  const joinGroup = useCallback(
    async (code: string, targetId: string, pin: string) => {
      if (pending) throw new Error("زامن العمليات المعلقة قبل تغيير المجموعة");
      const result = await api("POST", {
        action: "join",
        code,
        adminId: targetId,
        pin,
      });
      await del(queueKey);
      await applySnapshot(result);
    },
    [applySnapshot, pending],
  );
  const discardPending = useCallback(async () => {
    await del(queueKey);
    setPending(0);
    setPendingItems([]);
    const cached = await get<Snapshot>(snapshotKey);
    if (cached) await applySnapshot(cached);
    if (navigator.onLine) {
      const remote = await api("GET");
      if (remote.joined) await applySnapshot(remote);
    }
    setError("");
  }, [applySnapshot]);
  const discardOne = useCallback(
    async (id: string) => {
      await enqueueLock.current;
      if (syncing.current) throw new Error("تسنى حتى تكمل محاولة المزامنة");
      const queue = (await get<Queued[]>(queueKey)) ?? [];
      const remaining = queue.filter((item) => item.command.id !== id);
      if (remaining.length === queue.length) return;
      await set(queueKey, remaining);
      await del(`sandouq:receipt:${id}`);
      setPending(remaining.length);
      setPendingItems(
        remaining.map(({ command }) => ({
          id: command.id,
          type: command.type,
        })),
      );
      const cached = await get<Snapshot>(snapshotKey);
      if (cached) await applySnapshot(cached);
      if (!remaining.length) setError("");
    },
    [applySnapshot],
  );
  const importLocal = useCallback(
    (next: TreasuryState) => {
      if (cloudEnabled) throw new Error("استيراد السحابة كينشئ مجموعة جديدة");
      update(next);
      saveLocal(next);
    },
    [update],
  );
  const resetLocal = useCallback(async () => {
    if (cloudEnabled) throw new Error("التصفير المحلي غير متاح فالوضع السحابي");
    const previous = stateRef.current ?? undefined;
    const clean = createCleanLocalState(previous);
    for (const key of await keys()) {
      if (typeof key === "string" && key.startsWith("sandouq:receipt:"))
        await del(key);
    }
    update(clean);
    saveLocal(clean);
    setAdminId(clean.admins[0].id);
    localStorage.setItem("sandouq:admin", clean.admins[0].id);
  }, [update]);
  return {
    state,
    adminId,
    groupId,
    loading,
    error,
    pending,
    pendingItems,
    realtimeStatus,
    cloudEnabled,
    dispatch,
    switchAdmin,
    createGroup,
    lookupGroup,
    joinGroup,
    importLocal,
    resetLocal,
    retrySync: sync,
    refreshFromCloud,
    discardPending,
    discardOne,
    clearError: () => setError(""),
  };
}
