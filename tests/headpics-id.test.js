const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const elements = new Map();
const storage = new Map([["ff_logo_memory_v2", '[{"id":"wrong-old-id"}]']]);
const alerts = [];

function createElement(id) {
  return {
    id,
    value: "",
    checked: false,
    disabled: false,
    innerHTML: "",
    textContent: "",
    files: [],
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    blur() {},
  };
}

const document = {
  documentElement: {
    style: {
      setProperty() {},
    },
  },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement(id));
    return elements.get(id);
  },
  createElement() {
    return createElement("");
  },
};

const context = vm.createContext({
  document,
  localStorage: {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  },
  console,
  crypto: {
    randomUUID() {
      return "test-id";
    },
  },
  URL: {
    createObjectURL() {
      return "blob:test";
    },
    revokeObjectURL() {},
  },
  Blob,
  TextEncoder,
  Uint8Array,
  DataView,
  ArrayBuffer,
  setTimeout,
  clearTimeout,
  confirm() {
    return true;
  },
  alert(message) {
    alerts.push(String(message));
  },
  Image: function Image() {},
});

const appPath = path.join(__dirname, "..", "app.js");
const source = fs.readFileSync(appPath, "utf8");
vm.runInContext(
  `${source}
globalThis.__headpicsTest = {
  HEADPICS,
  headpicsById,
  exactHeadpicsByName,
  findExplicitHeadpics,
  logoNameMatchScore,
  duplicateHeadpicsIds,
  hasUniqueHeadpicsId,
  parseTeams,
  applyHeadpics,
  assign,
  pickForTeam,
  setHeadpics,
  matchNames,
  localAutoMatch,
  getTeams: () => teams,
  getLogos: () => logos,
  setState: (nextTeams, nextLogos = []) => {
    teams = nextTeams;
    logos = nextLogos;
    render();
  }
};`,
  context,
  { filename: appPath },
);

const api = context.__headpicsTest;

function team(name, avatar = "", id = "") {
  return {
    no: "1",
    team: name,
    avatar,
    id,
    file: null,
    headpicsSource: "",
    headpicsConflict: "",
  };
}

function logo(name, key = name) {
  return {
    name,
    key,
    url: `blob:${key}`,
    file: { name, type: "image/png" },
  };
}

function reset(nextTeams, nextLogos = []) {
  alerts.length = 0;
  api.setState(nextTeams, nextLogos);
}

// Bộ nhớ logo phiên bản cũ phải bị xóa ngay khi tải ứng dụng.
assert.equal(storage.has("ff_logo_memory_v2"), false);

// Bảng HEADPICS không được trùng ID và phải tra cứu hai chiều chính xác.
assert.equal(api.HEADPICS.length, 15);
assert.equal(new Set(api.HEADPICS.map(([, id]) => id)).size, api.HEADPICS.length);
for (const [name, id] of api.HEADPICS) {
  assert.equal(api.headpicsById(id)[0], name);
  assert.equal(api.exactHeadpicsByName(name.toLowerCase())[1], id);

  reset([team("EOP")]);
  assert.equal(
    api.applyHeadpics(api.getTeams()[0], logo(`team-${name.toLowerCase()}-logo.png`))[1],
    id,
  );

  reset([team("EOP")]);
  assert.equal(
    api.applyHeadpics(api.getTeams()[0], logo(`avatar_${id}.png`))[0],
    name,
  );

  assert.equal(api.findExplicitHeadpics(`X${name}Y.png`), null);
}

// Tên và ID chỉ khớp theo từ/cụm hoàn chỉnh, không khớp chuỗi con.
assert.equal(api.findExplicitHeadpics("KLA logo.png")[1], "902000062");
assert.equal(api.findExplicitHeadpics("image_902000006.png")[0], "ANDREW");
assert.equal(api.findExplicitHeadpics("MICKLA.png"), null);
assert.equal(api.findExplicitHeadpics("image_19020000062.png"), null);
assert.equal(api.findExplicitHeadpics("Andrew Kelly.png"), null);

// Không còn gán ID theo vị trí dòng khi logo không có bằng chứng.
reset([team("EOP")]);
assert.equal(api.applyHeadpics(api.getTeams()[0], logo("random.png")), null);
assert.equal(api.getTeams()[0].id, "");

reset([team("EOP")], [logo("random.png", "random")]);
api.assign("random", "0");
assert.equal(api.getTeams()[0].file.name, "random.png");
assert.equal(api.getTeams()[0].id, "");

reset([team("EOP")]);
api.pickForTeam(0, { name: "random.png", type: "image/png" });
assert.equal(api.getTeams()[0].id, "");

// Tên file rõ ràng được phép gán; tên team dài chỉ chứa tên nhân vật thì không.
reset([team("EOP")]);
assert.equal(api.applyHeadpics(api.getTeams()[0], logo("andrew-logo.png"))[1], "902000006");
assert.equal(api.getTeams()[0].headpicsSource, "filename");

reset([team("Andrew United")]);
assert.equal(api.applyHeadpics(api.getTeams()[0], logo("random.png")), null);
assert.equal(api.getTeams()[0].id, "");

// ID đã nhập/chọn là nguồn ưu tiên và không bị tên file ghi đè.
reset([team("EOP", "KELLY", "902000007")]);
assert.equal(api.applyHeadpics(api.getTeams()[0], logo("andrew.png"))[1], "902000007");
assert.equal(api.getTeams()[0].id, "902000007");

// Hai nguồn chỉ tới hai HEADPICS khác nhau phải bị đánh dấu xung đột.
reset([team("EOP", "ANDREW")]);
assert.equal(api.applyHeadpics(api.getTeams()[0], logo("kelly.png")), null);
assert.equal(api.getTeams()[0].id, "");
assert.match(api.getTeams()[0].headpicsConflict, /khác nhau/);

// Ghép tên file đúng team, không ép logo mơ hồ hoặc tên ngắn trùng chuỗi con.
reset(
  [team("EOP"), team("HQ")],
  [logo("HQ logo.png", "hq"), logo("Team EOP official.png", "eop")],
);
assert.equal(api.matchNames(), 2);
assert.equal(api.getTeams()[0].file.key, "eop");
assert.equal(api.getTeams()[1].file.key, "hq");

reset([team("EOP")], [logo("EOP.png", "a"), logo("EOP logo.png", "b")]);
assert.equal(api.matchNames(), 0);
assert.equal(api.getTeams()[0].file, null);

reset([team("EOP"), team("EOP")], [logo("EOP.png", "same")]);
assert.equal(api.matchNames(), 0);
assert.equal(api.getTeams()[0].file, null);
assert.equal(api.getTeams()[1].file, null);

reset([team("KLA")], [logo("MICKLA.png", "substring")]);
assert.equal(api.matchNames(), 0);
assert.equal(api.getTeams()[0].file, null);

reset([team("KLA")], [logo("KLA logo.png", "kla")]);
assert.equal(api.matchNames(), 1);
assert.equal(api.getTeams()[0].id, "902000062");

// Upload toàn bộ 15 logo theo thứ tự đảo vẫn phải về đúng từng HEADPICS.
reset(
  api.HEADPICS.map(([name, id], index) => ({
    no: String(index + 1),
    team: name,
    avatar: name,
    id,
    file: null,
    headpicsSource: "preset",
    headpicsConflict: "",
  })),
  [...api.HEADPICS]
    .reverse()
    .map(([name]) => logo(`${name.toLowerCase()}-logo.png`, name)),
);
assert.equal(api.matchNames(), api.HEADPICS.length);
for (const currentTeam of api.getTeams()) {
  assert.equal(currentTeam.file.key, currentTeam.avatar);
  assert.equal(api.headpicsById(currentTeam.id)[0], currentTeam.avatar);
}

// Team tùy ý có avatar/ID nhập sẵn vẫn giữ đúng ID khi logo được upload lộn thứ tự.
const customRoster = api.HEADPICS.map(([name, id], index) => ({
  no: String(index + 1),
  team: `SQUAD ${String(index + 1).padStart(2, "0")}`,
  avatar: name,
  id,
  file: null,
  headpicsSource: "input-id",
  headpicsConflict: "",
}));
const shuffledCustomLogos = customRoster
  .map((currentTeam, index) => logo(`${currentTeam.team} official.png`, `custom-${index}`))
  .sort((a, b) => b.name.localeCompare(a.name));
reset(customRoster, shuffledCustomLogos);
assert.equal(api.matchNames(), api.HEADPICS.length);
for (const currentTeam of api.getTeams()) {
  assert.match(currentTeam.file.name, new RegExp(currentTeam.team));
  assert.equal(api.headpicsById(currentTeam.id)[0], currentTeam.avatar);
}

// Parser chấp nhận dữ liệu hợp lệ, không suy diễn từ tên team dài và chặn avatar/ID mâu thuẫn.
reset([]);
api.parseTeams("1 Andrew\n2 Andrew United\nEOP | Kelly | 902000006");
assert.equal(api.getTeams()[0].id, "902000006");
assert.equal(api.getTeams()[1].id, "");
assert.equal(api.getTeams()[2].id, "");
assert.match(api.getTeams()[2].headpicsConflict, /không khớp/);

// ID trùng bị phát hiện; chọn thủ công không được chiếm ID của team khác.
reset([
  team("EOP", "ANDREW", "902000006"),
  team("HQ", "ANDREW", "902000006"),
]);
assert.equal(api.duplicateHeadpicsIds().has("902000006"), true);
assert.equal(api.hasUniqueHeadpicsId(api.getTeams()[0]), false);

reset([
  team("EOP", "ANDREW", "902000006"),
  team("HQ"),
]);
assert.equal(api.setHeadpics(1, "902000006"), false);
assert.equal(api.getTeams()[1].id, "");
assert.match(alerts[0], /đã được chọn/);
assert.equal(api.setHeadpics(1, "902000007"), true);
assert.equal(api.getTeams()[1].id, "902000007");
assert.equal(api.getTeams()[1].headpicsSource, "manual");

// Tự gắn an toàn không lấy logo đầu tiên và không cấp ID theo số thứ tự.
reset([team("EOP")], [logo("unknown.png", "unknown")]);
api.localAutoMatch();
assert.equal(api.getTeams()[0].file, null);
assert.equal(api.getTeams()[0].id, "");

console.log("headpics-id tests passed");
