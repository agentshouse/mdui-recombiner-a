import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import type { Runtime } from "../src/house.ts";
import {
  addBook,
  bindingError,
  initializeStore,
  loaded,
  loading,
  roomId,
  writable,
} from "../src/store.ts";
function observation(initial: unknown) {
  let value = initial;
  const listeners = new Set<(next: unknown) => void>();
  return {
    current: () => value,
    subscribe: (listener: (next: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => listeners.clear(),
    emit: (next: unknown) => {
      value = next;
      for (const listener of listeners) listener(next);
    },
  };
}
test("catalogue waits for first sync, recovers binding errors, and blocks lost reach without replacing Room identity", async () => {
  const observations = new Map([
    ["rooms", observation([])],
    [
      "sync-status",
      observation({ lastCompleted: null, attentionRequired: [] }),
    ],
    ["query", observation({ documents: [] })],
    ["service-mode", observation("open")],
    ["room-drafts", observation([])],
    ["storage-loss", observation(null)],
    ["connection-refusal", observation(null)],
  ]);
  const observed: string[] = [];
  let writes = 0;
  let saves = 0;
  const client = {
    observe: async (topic: string) => {
      observed.push(topic);
      return observations.get(topic);
    },
    persistence: async () => true,
    roomDraft: {
      read: async () => null,
      write: async () => { writes++; return {outcome: "written", roomDraft: {revision: `draft-${writes}`}}; },
    },
    save: async () => { saves++; return {outcome: "saved", identifier: "waiting-locally"}; },
  } as unknown as Runtime;
  const stop = await initializeStore(async () => client);
  const emit = (topic: string, value: unknown) =>
    observations.get(topic)?.emit(value);
  const room = {
    locator: "r",
    operations: { write: ["all"] },
    replica: { admission: "admitted" },
    refusal: null,
  };
  assert.equal(loading(), true);
  assert.equal(bindingError(), "");
  assert.equal(loaded(), false);
  assert.equal(observed.includes("query"), false);
  emit("rooms", [room, { ...room, locator: "other" }]);
  assert.equal(bindingError(), "");
  emit("sync-status", {
    lastCompleted: "2026-10-11T13:00:00Z",
    attentionRequired: [],
  });
  assert.match(bindingError(), /multiple data bindings/);
  emit("rooms", []);
  assert.match(bindingError(), /No Room/);
  emit("rooms", [room]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(bindingError(), "");
  assert.equal(loaded(), true);
  assert.equal(writable(), true);
  emit("service-mode", "write-halted");
  assert.equal(writable(), true);
  const sample = JSON.parse(fs.readFileSync("samples/manual.catalog.json", "utf8"))[0];
  assert.equal(await addBook(sample), true);
  assert.equal(writes, 1);
  assert.equal(saves, 1);
  emit("rooms", []);
  assert.equal(roomId(), "r");
  assert.equal(writable(), false);
  assert.equal(await addBook(sample), false);
  assert.equal(saves, 1);
  emit("rooms", [room]);
  assert.equal(bindingError(), "");
  assert.equal(writable(), true);
  assert.equal(observed.filter((topic) => topic === "query").length, 1);
  stop();
});
