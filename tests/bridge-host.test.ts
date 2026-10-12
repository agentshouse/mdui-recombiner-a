import assert from "node:assert/strict";
import { test } from "node:test";
import { houseBridge } from "@agentshouse/app-bridge";
import { createHouseBridgeTestHost } from "@agentshouse/app-bridge/test-host";
import { connect, type Runtime } from "../src/house.ts";

test("the official host supplies one ready bridge and the exact runtime", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "houseBridge");
  try {
    const host = createHouseBridgeTestHost({ address: "/books" });
    const bridge = houseBridge();
    assert.equal(bridge, Reflect.get(globalThis, "houseBridge"));
    assert.equal(Object.hasOwn(globalThis, "houseRuntime"), false);
    const pending = connect();
    const runtime = {} as Runtime;
    host.attachRuntime(runtime);
    assert.equal(await pending, runtime);
    assert.equal(await bridge.runtime, runtime);
    assert.deepEqual(host.tabs, [{ title: "Book Recombiner" }]);
    assert.equal(bridge.address(), "/books");
  } finally {
    if (previous) Object.defineProperty(globalThis, "houseBridge", previous);
    else Reflect.deleteProperty(globalThis, "houseBridge");
  }
});
