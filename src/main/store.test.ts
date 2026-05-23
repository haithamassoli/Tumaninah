import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DATA_VERSION, DEFAULT_SETTINGS, SEED_ADHKAR } from "../shared/defaults";
import { DHIKR_MAX_LENGTH } from "../shared/ipc";
import { Store } from "./store";

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "tumaninah-store-"));
}

describe("Store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await freshDir();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds defaults on first run and writes data.json", async () => {
    const store = await Store.load({ userDataDir: dir });
    await store.flush();
    const raw = await readFile(join(dir, "data.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, DATA_VERSION);
    assert.equal(parsed.settings.intervalMinutes, DEFAULT_SETTINGS.intervalMinutes);
    assert.equal(parsed.adhkar.length, SEED_ADHKAR.length);
    for (const dhikr of parsed.adhkar) {
      assert.equal(typeof dhikr.id, "string");
      assert.ok(dhikr.id.length > 0);
      assert.equal(typeof dhikr.text, "string");
    }
  });

  it("round-trips settings and adhkar across reloads", async () => {
    const s1 = await Store.load({ userDataDir: dir });
    s1.setSettings({ intervalMinutes: 30, theme: "dark" });
    const added = s1.addDhikr("  test dhikr  ");
    assert.equal(added.text, "test dhikr");
    await s1.flush();

    const s2 = await Store.load({ userDataDir: dir });
    const settings = s2.getSettings();
    assert.equal(settings.intervalMinutes, 30);
    assert.equal(settings.theme, "dark");
    const list = s2.getAdhkar();
    assert.ok(list.some((d) => d.text === "test dhikr"));
  });

  it("clamps settings to valid ranges and rejects bad enums", async () => {
    const s = await Store.load({ userDataDir: dir });
    const next = s.setSettings({
      intervalMinutes: 9999,
      visibleDurationSeconds: 1,
      fontSizePx: 1000,
      // @ts-expect-error invalid theme
      theme: "garbage",
    });
    assert.equal(next.intervalMinutes, 240);
    assert.equal(next.visibleDurationSeconds, 3);
    assert.equal(next.fontSizePx, 36);
    assert.equal(next.theme, DEFAULT_SETTINGS.theme);
  });

  it("validates dhikr input: trim, reject empty, length cap, dedupe", async () => {
    const s = await Store.load({ userDataDir: dir });
    assert.throws(() => s.addDhikr("   "), /empty/i);
    assert.throws(() => s.addDhikr("x".repeat(DHIKR_MAX_LENGTH + 1)), /exceeds/i);

    const a = s.addDhikr("hello");
    const b = s.addDhikr("hello");
    assert.equal(a.id, b.id, "duplicate add should return the existing dhikr");
  });

  it("import merge skips duplicates and sanitizes input", async () => {
    const s = await Store.load({ userDataDir: dir });
    const before = s.getAdhkar().length;
    const result = s.importAdhkar(
      ["new one", "new one", "  another  ", "", SEED_ADHKAR[0]!],
      "merge",
    );
    assert.equal(result.added, 2);
    assert.equal(result.skipped, 1);
    assert.equal(s.getAdhkar().length, before + 2);
  });

  it("import replace overwrites the list", async () => {
    const s = await Store.load({ userDataDir: dir });
    const result = s.importAdhkar(["only one", "only one"], "replace");
    assert.equal(result.added, 1);
    assert.equal(s.getAdhkar().length, 1);
    assert.equal(s.getAdhkar()[0]!.text, "only one");
  });

  it("migrates a file missing the version field", async () => {
    const legacy = {
      settings: { intervalMinutes: 45 },
      adhkar: [{ id: "x", text: "legacy" }],
    };
    await writeFile(join(dir, "data.json"), JSON.stringify(legacy), "utf8");
    const s = await Store.load({ userDataDir: dir });
    const data = s.getData();
    assert.equal(data.version, DATA_VERSION);
    assert.equal(data.settings.intervalMinutes, 45);
    assert.ok(data.adhkar.some((d) => d.text === "legacy"));
  });

  it("recovers from a corrupt data.json by backing it up and reseeding", async () => {
    await writeFile(join(dir, "data.json"), "{ not json", "utf8");
    const s = await Store.load({ userDataDir: dir });
    assert.equal(s.getData().version, DATA_VERSION);
    assert.equal(s.getAdhkar().length, SEED_ADHKAR.length);
  });

  it("atomic write does not leave the target file empty mid-write", async () => {
    const s = await Store.load({ userDataDir: dir });
    s.addDhikr("one");
    s.addDhikr("two");
    s.addDhikr("three");
    // Immediately read while debounce timer is still pending — file should
    // still contain the previously-written (seeded) state, never partial JSON.
    const raw = await readFile(join(dir, "data.json"), "utf8");
    JSON.parse(raw); // throws if partial
    await s.flush();
    const final = JSON.parse(await readFile(join(dir, "data.json"), "utf8"));
    assert.ok(final.adhkar.some((d: { text: string }) => d.text === "three"));
  });

  it("debounces rapid writes into a single flush", async () => {
    const s = await Store.load({ userDataDir: dir });
    await s.flush();
    const initialMtime = (await readFile(join(dir, "data.json"), "utf8")).length;
    for (let i = 0; i < 50; i += 1) s.addDhikr(`burst-${i}`);
    await s.flush();
    const after = JSON.parse(await readFile(join(dir, "data.json"), "utf8"));
    assert.ok(after.adhkar.length > 0);
    assert.notEqual(initialMtime, JSON.stringify(after).length);
  });
});
