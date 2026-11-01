import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  applyCommand,
  newId,
  type Command,
  type TreasuryState,
} from "@/lib/domain";
import { createEmptyState } from "@/lib/seed";
import { validateImport } from "@/lib/report";

const scrypt = promisify(callbackScrypt);
function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase غير مهيأ فالسيرفر");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function hashSecret(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(value, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}
async function verifySecret(value: string, encoded: string) {
  const [salt, hex] = encoded.split(":");
  if (!salt || !hex) return false;
  const derived = (await scrypt(value, salt, 64)) as Buffer;
  const stored = Buffer.from(hex, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}
async function auth(request: NextRequest, db: SupabaseClient) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) throw new Error("خاص تسجيل الدخول فالجهاز");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("انتهت جلسة الجهاز؛ عاود الدخول");
  return data.user.id;
}
async function membership(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("device_memberships")
    .select("group_id,admin_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as { group_id: string; admin_id: string } | null;
}
async function snapshot(db: SupabaseClient, userId: string) {
  const joined = await membership(db, userId);
  if (!joined) return { joined: false };
  const { data: activeAdmin, error: adminError } = await db
    .from("admins")
    .select("active")
    .eq("id", joined.admin_id)
    .eq("group_id", joined.group_id)
    .maybeSingle();
  if (adminError) throw adminError;
  if (!activeAdmin?.active) return { joined: false };
  const { data, error } = await db
    .from("group_state")
    .select("data,revision")
    .eq("group_id", joined.group_id)
    .single();
  if (error) throw error;
  return {
    joined: true,
    state: data.data as TreasuryState,
    adminId: joined.admin_id,
    groupId: joined.group_id,
  };
}
function fail(error: unknown, status = 400) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "وقع مشكل غير متوقع" },
    { status },
  );
}
function cleanName(value: unknown, limit: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > limit) throw new Error("الاسم غير صالح");
  return text;
}
function cleanPin(value: unknown) {
  const pin = String(value ?? "");
  if (!/^\d{6}$/.test(pin)) throw new Error("رمز المشرف خاصو يكون 6 أرقام");
  return pin;
}
function codeValue() {
  return `SND-${randomBytes(18).toString("base64url").toUpperCase()}`;
}
async function findGroup(db: SupabaseClient, code: string) {
  const { data, error } = await db
    .from("groups")
    .select("id,name,code_hash")
    .eq("code_prefix", code.slice(0, 8))
    .limit(20);
  if (error) throw error;
  for (const group of data ?? [])
    if (await verifySecret(code, group.code_hash)) return group;
  throw new Error("رمز المجموعة غير صحيح");
}
async function verifyAdminPin(
  db: SupabaseClient,
  admin: { id: string; pin_hash: string } | null,
  pin: string,
) {
  if (!admin) throw new Error("رمز المشرف غير صحيح");
  const { data: throttle, error } = await db
    .from("admin_pin_attempts")
    .select("blocked_until")
    .eq("admin_id", admin.id)
    .maybeSingle();
  if (error) throw error;
  if (
    throttle?.blocked_until &&
    Date.parse(throttle.blocked_until) > Date.now()
  )
    throw new Error("محاولات كثيرة؛ عاود من بعد 15 دقيقة");
  if (!(await verifySecret(pin, admin.pin_hash))) {
    const { error: failureError } = await db.rpc("record_pin_failure", {
      p_admin_id: admin.id,
    });
    if (failureError) throw failureError;
    throw new Error("رمز المشرف غير صحيح");
  }
  const { error: clearError } = await db.rpc("clear_pin_failures", {
    p_admin_id: admin.id,
  });
  if (clearError) throw clearError;
}
async function createGroup(
  db: SupabaseClient,
  userId: string,
  body: Record<string, unknown>,
) {
  const name = cleanName(body.name, 120);
  const adminName = cleanName(body.adminName, 80);
  const pin = cleanPin(body.pin);
  const groupId = newId(),
    adminId = newId(),
    code = codeValue();
  let state = createEmptyState(groupId, name, adminId, adminName);
  if (body.importData) {
    const imported = validateImport(body.importData);
    state = {
      ...imported,
      group: { id: groupId, name },
      admins: [
        ...imported.admins.map((a) => ({
          id: a.id,
          name: a.name,
          active: false,
        })),
        { id: adminId, name: adminName, active: true },
      ],
      expenses: imported.expenses.map((e) => ({ ...e, receiptId: undefined })),
      revision: 0,
    };
  }
  const { error } = await db.rpc("bootstrap_group", {
    p_group_id: groupId,
    p_name: name,
    p_code_prefix: code.slice(0, 8),
    p_code_hash: await hashSecret(code),
    p_admin_id: adminId,
    p_admin_name: adminName,
    p_pin_hash: await hashSecret(pin),
    p_user_id: userId,
    p_data: state,
  });
  if (error) throw error;
  return { joined: true, state, adminId, groupId, code };
}
function normalizeCommand(
  raw: Command,
  adminId: string,
  groupId: string,
): Command {
  if (
    !raw ||
    typeof raw !== "object" ||
    typeof raw.id !== "string" ||
    raw.id.length > 80
  )
    throw new Error("عملية غير صالحة");
  const now = new Date().toISOString();
  const command = { ...raw, adminId } as Command;
  if ("at" in command) {
    if (["payment", "waiver", "undo"].includes(command.type)) {
      const timestamp = Date.parse(String(command.at));
      if (
        !Number.isFinite(timestamp) ||
        timestamp > Date.now() + 5 * 60_000 ||
        timestamp < Date.now() - 365 * 24 * 60 * 60_000
      )
        throw new Error("توقيت العملية غير صالح");
    } else command.at = now;
  }
  if (command.type === "expense") {
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(command.spentAt) ||
      !Number.isFinite(Date.parse(command.spentAt))
    )
      throw new Error("تاريخ المصروف غير صالح");
    if (
      command.receiptId &&
      !command.receiptId.startsWith(`receipt:${groupId}/`)
    )
      throw new Error("مرجع الوصل غير صالح");
  }
  if (command.type === "correct_expense" && command.replacement) {
    if (!Number.isFinite(Date.parse(command.replacement.spentAt)) ||
        (command.replacement.receiptId &&
         !command.replacement.receiptId.startsWith(`receipt:${groupId}/`)))
      throw new Error("بيانات المصروف المصحح غير صالحة");
  }
  if (
    command.type === "receipt" &&
    !command.receiptId.startsWith(`receipt:${groupId}/`)
  )
    throw new Error("مرجع الوصل غير صالح");
  if (command.type === "member")
    command.member = {
      ...command.member,
      name: cleanName(command.member.name, 80),
    };
  if (command.type === "admin_edit") {
    command.name = cleanName(command.name, 80);
    if (command.pin !== undefined) cleanPin(command.pin);
  }
  return command;
}
async function commitCommand(
  db: SupabaseClient,
  joined: { group_id: string; admin_id: string },
  raw: Command,
) {
  if (raw.adminId !== joined.admin_id)
    throw new Error("تبدل المشرف فهاد الجهاز؛ راجع العمليات المعلقة");
  const command = normalizeCommand(raw, joined.admin_id, joined.group_id);
  if (command.type === "admin") {
    const pin = cleanPin(command.admin.pin);
    const safe = {
      ...command,
      admin: {
        id: command.admin.id,
        name: cleanName(command.admin.name, 80),
        active: true,
      },
    } as Command;
    const { data: row, error } = await db
      .from("group_state")
      .select("data,revision")
      .eq("group_id", joined.group_id)
      .single();
    if (error) throw error;
    const previous = row.data as TreasuryState;
    if (previous.appliedIds.includes(command.id)) return previous;
    const next = applyCommand(previous, safe);
    const { data: ok, error: rpcError } = await db.rpc("add_group_admin", {
      p_group_id: joined.group_id,
      p_admin_id: command.admin.id,
      p_name: command.admin.name,
      p_pin_hash: await hashSecret(pin),
      p_expected_revision: row.revision,
      p_data: next,
    });
    if (rpcError) throw rpcError;
    if (!ok) throw new Error("تبدلات البيانات؛ عاود المحاولة");
    return next;
  }
  if (command.type === "admin_status" || command.type === "admin_edit" || command.type === "admin_archive") {
    const { data: row, error } = await db
      .from("group_state")
      .select("data,revision")
      .eq("group_id", joined.group_id)
      .single();
    if (error) throw error;
    const previous = row.data as TreasuryState;
    if (previous.appliedIds.includes(command.id)) return previous;
    const safe = command.type === "admin_edit" ? { ...command, pin: undefined } : command;
    const next = applyCommand(previous, safe);
    const call = command.type === "admin_status"
      ? { name: "set_group_admin_status", args: {
          p_group_id: joined.group_id, p_admin_id: command.targetId,
          p_active: command.active, p_expected_revision: row.revision, p_data: next,
        } }
      : { name: "mutate_group_admin", args: {
          p_group_id: joined.group_id, p_admin_id: command.targetId,
          p_name: command.type === "admin_edit" ? command.name : null,
          p_pin_hash: command.type === "admin_edit" && command.pin ? await hashSecret(command.pin) : null,
          p_archived: command.type === "admin_archive" ? command.archived : null,
          p_expected_revision: row.revision, p_data: next,
        } };
    const { data: ok, error: rpcError } = await db.rpc(call.name, call.args);
    if (rpcError) throw rpcError;
    if (!ok) throw new Error("تبدلات البيانات؛ عاود المحاولة");
    return next;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error } = await db
      .from("group_state")
      .select("data,revision")
      .eq("group_id", joined.group_id)
      .single();
    if (error) throw error;
    const previous = row.data as TreasuryState;
    if (previous.appliedIds.includes(command.id)) return previous;
    const next = applyCommand(previous, command);
    const { data: ok, error: rpcError } = await db.rpc("cas_group_state", {
      p_group_id: joined.group_id,
      p_expected_revision: row.revision,
      p_data: next,
    });
    if (rpcError) throw rpcError;
    if (ok) return next;
    if (
      command.type === "minimum" ||
      command.type === "member" ||
      command.type === "delete_member" ||
      command.type === "monthly_contribution" ||
      command.type.startsWith("correct_") ||
      command.type === "minimum_rule"
    )
      throw new Error("تبدلات البيانات من جهاز آخر؛ راجعها قبل الحفظ");
  }
  throw new Error("تعذر حفظ العملية بسبب تعديلات متزامنة؛ عاود المحاولة");
}

export async function GET(request: NextRequest) {
  try {
    const db = service();
    const userId = await auth(request, db);
    return NextResponse.json(await snapshot(db, userId));
  } catch (error) {
    return fail(error, 401);
  }
}
export async function POST(request: NextRequest) {
  try {
    const db = service();
    const userId = await auth(request, db);
    const body = (await request.json()) as Record<string, unknown>;
    switch (body.action) {
      case "create":
        return NextResponse.json(await createGroup(db, userId, body));
      case "lookup": {
        const group = await findGroup(db, String(body.code ?? ""));
        const { data, error } = await db
          .from("admins")
          .select("id,name")
          .eq("group_id", group.id)
          .eq("active", true);
        if (error) throw error;
        return NextResponse.json({ groupName: group.name, admins: data });
      }
      case "join": {
        const group = await findGroup(db, String(body.code ?? ""));
        const { data: admin, error } = await db
          .from("admins")
          .select("id,pin_hash")
          .eq("group_id", group.id)
          .eq("id", body.adminId)
          .eq("active", true)
          .maybeSingle();
        if (error) throw error;
        await verifyAdminPin(db, admin, String(body.pin ?? ""));
        if (!admin) throw new Error("رمز المشرف غير صحيح");
        const { error: joinError } = await db.from("device_memberships").upsert(
          {
            user_id: userId,
            group_id: group.id,
            admin_id: admin.id,
            joined_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (joinError) throw joinError;
        return NextResponse.json(await snapshot(db, userId));
      }
      case "switch": {
        const joined = await membership(db, userId);
        if (!joined) throw new Error("دخل للمجموعة أولا");
        const { data: admin, error } = await db
          .from("admins")
          .select("id,pin_hash")
          .eq("group_id", joined.group_id)
          .eq("id", body.adminId)
          .eq("active", true)
          .maybeSingle();
        if (error) throw error;
        await verifyAdminPin(db, admin, String(body.pin ?? ""));
        if (!admin) throw new Error("رمز المشرف غير صحيح");
        const { error: updateError } = await db
          .from("device_memberships")
          .update({ admin_id: admin.id })
          .eq("user_id", userId);
        if (updateError) throw updateError;
        return NextResponse.json(await snapshot(db, userId));
      }
      case "command": {
        const joined = await membership(db, userId);
        if (!joined) throw new Error("دخل للمجموعة أولا");
        const state = await commitCommand(db, joined, body.command as Command);
        return NextResponse.json({ state, adminId: joined.admin_id });
      }
      default:
        throw new Error("طلب غير معروف");
    }
  } catch (error) {
    return fail(error);
  }
}
