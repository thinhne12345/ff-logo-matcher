const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const elements = new Map();
const cssVariables = new Map();
const storage = new Map();

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
      setProperty(name, value) {
        cssVariables.set(name, value);
      },
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
  },
  console,
  crypto: { randomUUID: () => "test-id" },
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL() {},
  },
  Blob,
  TextEncoder,
  Uint8Array,
  DataView,
  ArrayBuffer,
  setTimeout,
  clearTimeout,
  confirm: () => true,
  alert() {},
  Image: function Image() {},
});

const appPath = path.join(__dirname, "..", "app.js");
const source = fs.readFileSync(appPath, "utf8");
vm.runInContext(
  `${source}
globalThis.__cornerColorTest = {
  normalizeHexColor,
  setCornerColor,
  drawCornerFrame,
  getCornerColor: () => cornerColor
};`,
  context,
  { filename: appPath },
);

const api = context.__cornerColorTest;

assert.equal(api.getCornerColor(), "#C0C0C0");
assert.equal(cssVariables.get("--corner-color"), "#C0C0C0");
assert.equal(api.normalizeHexColor("68228b"), "#68228B");
assert.equal(api.normalizeHexColor("#abc"), "#AABBCC");
assert.equal(api.normalizeHexColor("#12GG34"), "");

assert.equal(api.setCornerColor("#68228B"), true);
assert.equal(api.getCornerColor(), "#68228B");
assert.equal(cssVariables.get("--corner-color"), "#68228B");
assert.equal(elements.get("cornerColorPicker").value, "#68228b");
assert.equal(elements.get("cornerColorHex").value, "#68228B");
assert.equal(storage.get("ff_corner_color_v1"), "#68228B");

const canvas = {
  strokes: 0,
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {
    this.strokes += 1;
  },
};

api.drawCornerFrame(canvas);
assert.equal(canvas.strokeStyle, "#68228B");
assert.equal(canvas.shadowColor, "#68228B");
assert.equal(canvas.strokes, 4);

console.log("corner-color tests passed");
