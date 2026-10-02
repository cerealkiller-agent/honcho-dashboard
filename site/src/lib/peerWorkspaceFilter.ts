// undefined follows the global active workspace, null lists all workspaces,
// and a string pins a workspace. Keep control values separate from real IDs.
export type PeerWorkspaceFilter = string | null | undefined;

export function readPeerWorkspaceFilter(hash: string): PeerWorkspaceFilter {
  const [route, query = ""] = hash.replace(/^#\/?/, "").split("?");
  if (route !== "peers") return undefined;
  const params = new URLSearchParams(query);
  const workspaceId = params.get("ws");
  if (workspaceId) return workspaceId;
  return params.get("scope") === "all" ? null : undefined;
}

export function peersHash(workspaceId: PeerWorkspaceFilter): string {
  if (workspaceId === undefined) return "#/peers";
  if (workspaceId === null) return "#/peers?scope=all";
  return `#/peers?ws=${encodeURIComponent(workspaceId)}`;
}
