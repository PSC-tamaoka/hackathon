const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");
// RNを起動せず、時刻・保存・競合を純粋なロジックとして検証する。
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { rallyWindow, rallyPeriod, rallyMissions } = require("../src/lib/eventRally.ts");
const { createMockEventDetailRepository } = require("../src/repositories/eventDetailRepository.ts");
const event = { id: "demo", date: "2026-10-20", startTime: "10:00" };
const start = Date.parse("2026-10-20T10:00:00+09:00");
function setup() {
  const records = new Map();
  let clock = start;
  const storage = {
    failRead: false, failWrite: false,
    getItem: async (key) => { if (storage.failRead) throw Error("read failure"); return records.get(key) ?? null; },
    setItem: async (key, value) => { if (storage.failWrite) throw Error("write failure"); records.set(key, value); },
  };
  const make = (user = "alice") => createMockEventDetailRepository(storage, [event], user, () => clock);
  return { storage, make, repository: make(), setClock: (time) => { clock = time; } };
}
test("日本時間の開始・翌々日0時を厳密に判定する", () => {
  const end = Date.parse("2026-10-22T00:00:00+09:00");
  assert.deepEqual(rallyWindow(event), { start, end });
  assert.equal(rallyPeriod(event, start - 1), "before");
  assert.equal(rallyPeriod(event, start), "active");
  assert.equal(rallyPeriod(event, end - 1), "active");
  assert.equal(rallyPeriod(event, end), "expired");
});
test("月末・年末を越えても終了時刻が正しい", () => {
  assert.equal(rallyWindow({ date: "2026-12-31", startTime: "23:00" }).end, Date.parse("2027-01-02T00:00:00+09:00"));
});
test("不正な日付では達成を許可しない", () => {
  assert.equal(rallyPeriod({ date: "invalid", startTime: "invalid" }), "expired");
});
test("イベントIDから取得し、不明なIDは見つからない", async () => {
  const { repository } = setup();
  assert.equal(await repository.getEvent("demo"), event);
  assert.equal(await repository.getEvent("unknown"), undefined);
});
test("開始前・公開終了後は達成を拒否", async () => {
  const { repository, setClock } = setup();
  setClock(start - 1);
  await assert.rejects(repository.completeMission(event, "cutter"));
  setClock(rallyWindow(event).end);
  await assert.rejects(repository.completeMission(event, "cutter"));
  assert.deepEqual((await repository.getParticipation(event)).completed, []);
});
test("参加取消後は達成できず、登録状態も復元される", async () => {
  const { repository, make } = setup();
  await repository.setRegistered(event, false);
  await assert.rejects(repository.completeMission(event, "cutter"));
  assert.equal((await make().getParticipation(event)).registered, false);
});
test("5つを任意の順番で達成し、リポジトリを作り直しても復元できる", async () => {
  const { repository, make } = setup();
  for (const mission of [...rallyMissions].reverse()) await repository.completeMission(event, mission.id);
  const saved = await make().getParticipation(event);
  assert.equal(saved.completed.length, 5);
  assert.ok(rallyMissions.every((mission) => saved.completed.includes(mission.id)));
});
test("同時送信でも二重達成・他ミッションの消失が起きない", async () => {
  const { repository } = setup();
  await Promise.all([repository.completeMission(event, "cutter"), repository.completeMission(event, "cutter"), repository.completeMission(event, "photo")]);
  assert.deepEqual((await repository.getParticipation(event)).completed, ["cutter", "photo"]);
});
test("保存失敗では未達成のままで、再試行できる", async () => {
  const { repository, storage } = setup();
  storage.failWrite = true;
  await assert.rejects(repository.completeMission(event, "cutter"));
  assert.deepEqual((await repository.getParticipation(event)).completed, []);
  storage.failWrite = false;
  assert.deepEqual((await repository.completeMission(event, "cutter")).completed, ["cutter"]);
});
test("読込失敗時に既存進捗を空で上書きしない", async () => {
  const { repository, storage } = setup();
  await repository.completeMission(event, "cutter");
  storage.failRead = true;
  await assert.rejects(repository.completeMission(event, "photo"));
  storage.failRead = false;
  assert.deepEqual((await repository.getParticipation(event)).completed, ["cutter"]);
});
test("参加者・イベント・開催日ごとに進捗を分離する", async () => {
  const { repository, make } = setup();
  await repository.completeMission(event, "cutter");
  assert.deepEqual((await make("bob").getParticipation(event)).completed, []);
  assert.deepEqual((await repository.getParticipation({ ...event, id: "other" })).completed, []);
  assert.deepEqual((await repository.getParticipation({ ...event, date: "2026-11-20" })).completed, []);
});
test("公開終了後も基本情報と保存済み達成履歴を保持する", async () => {
  const { repository, setClock } = setup();
  await repository.completeMission(event, "cutter");
  setClock(rallyWindow(event).end);
  assert.equal(await repository.getEvent("demo"), event);
  assert.deepEqual((await repository.getParticipation(event)).completed, ["cutter"]);
});
test("未知のミッションは達成できない", async () => {
  await assert.rejects(setup().repository.completeMission(event, "unknown"));
});
