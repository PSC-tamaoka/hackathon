const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { rallyMissions } = require("../src/lib/eventRally.ts");

// RNを起動せず実際のapi.tsを読み込み、通信先だけを差し替える。
function loadApi({ rpc, isMock = false } = {}) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const future = new Date(`${today}T00:00:00+09:00`);
  future.setUTCDate(future.getUTCDate() + 7);
  const futureDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(future);
  const event = { id: "mock", title: "mock event", date: today, startTime: "00:00", endTime: "23:59", capacity: 10, remaining: 8 };
  const stubs = {
    "expo-linking": { createURL: (value) => `shibukawa://${value}` },
    "@/src/constants/images": { images: {} },
    "@/src/constants/mockEvents": { mockEvents: [event, { ...event, id: "future", date: futureDate }] },
    "./supabase": { isMock, supabase: isMock ? null : { rpc } },
  };
  const file = path.resolve(__dirname, "../src/lib/api.ts");
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : originalRequire(id);
  loaded._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return loaded.exports;
}

test("実DBモードでは詳細・招待トークン・参加・取消・ラリーをRPC経由で処理する", async () => {
  const calls = [];
  const api = loadApi({ rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === "get_event") return { data: [{
      id: 42, title: "DBのイベント", description: "", event_date: "2026-10-18", start_time: "10:00", end_time: "17:00",
      place: "渋川", capacity: 10, remaining: 9, scope: "closed", tags: [], status: "published",
      is_registered: true, checked_todo_ids: ["t1"],
    }], error: null };
    return { data: name === "complete_rally_mission" ? ["cutter"] : [], error: null };
  } });
  const event = await api.getEvent("42", "invite-token");
  assert.equal(event.title, "DBのイベント");
  assert.equal(event.isRegistered, true);
  assert.deepEqual(event.checkedTodoIds, ["t1"]);
  assert.deepEqual(await api.getRallyProgress("42"), []);
  assert.deepEqual(await api.completeRallyMission("42", "cutter"), ["cutter"]);
  await api.applyEvent("42", "invite-token");
  await api.cancelRegistration("42");
  assert.deepEqual(calls, [
    { name: "get_event", args: { p_event_id: 42, p_invite_token: "invite-token" } },
    { name: "get_rally_progress", args: { p_event_id: 42 } },
    { name: "complete_rally_mission", args: { p_event_id: 42, p_mission_id: "cutter" } },
    { name: "apply_event", args: { p_event_id: 42, p_invite_token: "invite-token" } },
    { name: "cancel_registration", args: { p_event_id: 42 } },
  ]);
});

test("保存失敗を達成扱いにせず、成功後にだけDBの結果を返す", async () => {
  let failing = true;
  const api = loadApi({ rpc: async () => failing
    ? { data: null, error: { message: "参加登録が必要です" } }
    : { data: ["cutter"], error: null } });
  await assert.rejects(api.completeRallyMission("42", "cutter"), /参加登録が必要/);
  failing = false;
  assert.deepEqual(await api.completeRallyMission("42", "cutter"), ["cutter"]);
});

test("進捗は毎回本人のDBから取得し、別ユーザーへキャッシュを持ち越さない", async () => {
  let user = "alice";
  const api = loadApi({ rpc: async () => ({ data: user === "alice" ? ["cutter"] : [], error: null }) });
  assert.deepEqual(await api.getRallyProgress("42"), ["cutter"]);
  user = "bob";
  assert.deepEqual(await api.getRallyProgress("42"), []);
});

test("モックでも旧TODOと進捗を分け、固定5項目の同時送信・二重送信で消失しない", async () => {
  const api = loadApi({ isMock: true });
  assert.deepEqual(await api.getRallyProgress("mock"), []);
  await Promise.all(rallyMissions.map((mission) => api.completeRallyMission("mock", mission.id)));
  await api.completeRallyMission("mock", "cutter");
  const progress = await api.getRallyProgress("mock");
  assert.equal(progress.length, 5);
  assert.ok(rallyMissions.every((mission) => progress.includes(mission.id)));
  assert.deepEqual((await api.getEvent("mock")).checkedTodoIds, ["t1", "t2"]);
  progress.length = 0;
  assert.equal((await api.getRallyProgress("mock")).length, 5);
});

test("モックでも参加取消・期間外・未知のミッションでは達成させない", async () => {
  const api = loadApi({ isMock: true });
  await api.completeRallyMission("mock", "cutter");
  await api.cancelRegistration("mock");
  await assert.rejects(api.completeRallyMission("mock", "net"), /参加登録が必要/);
  await api.applyEvent("mock");
  assert.deepEqual(await api.getRallyProgress("mock"), ["cutter"]);
  await assert.rejects(api.completeRallyMission("future", "cutter"), /利用時間外/);
  await assert.rejects(api.completeRallyMission("mock", "unknown"), /ミッションが見つかりません/);
});
