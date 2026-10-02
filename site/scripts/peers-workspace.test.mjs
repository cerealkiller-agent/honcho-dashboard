import assert from "node:assert/strict";
import test from "node:test";
import { peersHash, readPeerWorkspaceFilter } from "../src/lib/peerWorkspaceFilter.ts";
import { honcho } from "../src/lib/honcho/client.ts";
import { HonchoApiError } from "../src/lib/honcho/types.ts";

test("Peers links pin the exact workspace, including former sentinel IDs", () => {
  for (const id of ["ws-a", "all", "__active__", "research + notes&archive", "日本語", "literal%20id"]) {
    assert.equal(readPeerWorkspaceFilter(peersHash(id)), id);
  }
});

test("unscoped Peers URLs follow the active workspace", () => {
  for (const hash of ["#/peers", "#/peers?ws=", "#/peers?other=value", "#/messages?ws=ws-a", ""]) {
    assert.equal(readPeerWorkspaceFilter(hash), undefined);
  }
});

test("all-workspace filtering is distinct from a workspace named all", () => {
  assert.equal(readPeerWorkspaceFilter(peersHash(null)), null);
  assert.equal(readPeerWorkspaceFilter(peersHash(undefined)), undefined);
  assert.equal(readPeerWorkspaceFilter("#/peers?scope=all&ws=ws-a"), "ws-a");
});

test("hash parsing tolerates malformed escapes and reads only the ws parameter", () => {
  assert.doesNotThrow(() => readPeerWorkspaceFilter("#/peers?ws=%E0%A4%A"));
  assert.equal(readPeerWorkspaceFilter("#/peers?other=ws-b&ws=ws-a"), "ws-a");
});

test("Peers and shell reads use only non-creating endpoints with encoded IDs", async (t) => {
  const calls = [];
  const page = { items: [], total: 0, page: 1, size: 100, pages: 1 };
  const queue = { total_work_units: 0, completed_work_units: 0, pending_work_units: 0, in_progress_work_units: 0 };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const value = url.endsWith("/card") ? { peer_card: ["Synthetic card"] }
      : url.endsWith("/search") ? [] : url.endsWith("/queue/status") ? queue : page;
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  });
  const opts = { baseUrl: "http://synthetic.invalid:8000" };
  const ws = "ws & +";
  const peer = "notes +";
  const prefix = `/api/honcho/v3/workspaces/${encodeURIComponent(ws)}`;
  const peerPath = `${prefix}/peers/${encodeURIComponent(peer)}`;
  assert.deepEqual(await honcho.peers.list(opts, ws, { size: 100 }), page);
  assert.deepEqual(await honcho.peers.card(opts, ws, peer), ["Synthetic card"]);
  assert.deepEqual(await honcho.peers.sessions(opts, ws, peer, { size: 1 }), page);
  assert.deepEqual(await honcho.peers.search(opts, ws, peer, { query: "notes", limit: 20 }), []);
  assert.deepEqual(await honcho.queue.status(opts, ws), queue);
  assert.deepEqual(calls, [
    { url: `${prefix}/peers/list?size=100`, method: "POST", body: {} },
    { url: `${peerPath}/card`, method: "GET", body: undefined },
    { url: `${peerPath}/sessions?size=1`, method: "POST", body: {} },
    { url: `${peerPath}/search`, method: "POST", body: { query: "notes", limit: 20 } },
    { url: `${prefix}/queue/status`, method: "GET", body: undefined },
  ]);
});

for (const status of [403, 404]) {
  test(`Peers reads preserve HTTP ${status} instead of creating a workspace or returning empty success`, async (t) => {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ detail: "Workspace unavailable" }), { status, headers: { "content-type": "application/json" } });
    });
    await assert.rejects(honcho.peers.list({ baseUrl: "http://synthetic.invalid:8000" }, "missing"),
      (error) => error instanceof HonchoApiError && error.status === status);
    assert.deepEqual(calls, ["/api/honcho/v3/workspaces/missing/peers/list"]);
  });
}
