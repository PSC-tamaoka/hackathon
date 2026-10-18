const fs = require("node:fs");
const ts = require("typescript");
const test = require("node:test");
const assert = require("node:assert/strict");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { rallyWindow, rallyPeriod } = require("../src/lib/eventRally.ts");
const event = { date: "2026-10-20", startTime: "10:00" };

test("日本時間の開始・翌々日0時を厳密に判定する", () => {
  const start = Date.parse("2026-10-20T10:00:00+09:00");
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
