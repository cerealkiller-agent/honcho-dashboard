"use client";

import { useEffect, useMemo } from "react";
import { honcho } from "@/lib/honcho/client";
import { useActiveWorkspace } from "@/lib/honcho/config";
import { useHonchoQuery } from "@/lib/honcho/useQuery";
import { Select } from "@/components/Select";

export function WorkspaceSelector({ className }: { className?: string }) {
  const { workspaceId, setWorkspaceId } = useActiveWorkspace();
  const { data, isLoading, error } = useHonchoQuery("workspaces/list?size=100", (o) =>
    honcho.workspaces.list(o, { size: 100 }),
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const options = useMemo(() => {
    const result = items.map((w) => ({ value: w.id, label: w.id }));
    // A paginated or restricted list is not proof that the selected workspace
    // does not exist. Preserve explicit navigation instead of silently switching.
    if (workspaceId && !items.some((w) => w.id === workspaceId)) {
      result.push({ value: workspaceId, label: workspaceId });
    }
    return result;
  }, [items, workspaceId]);

  useEffect(() => {
    if (!workspaceId && items.length > 0) {
      setWorkspaceId(items[0].id);
    }
  }, [items, workspaceId, setWorkspaceId]);

  return (
    <Select
      className={className}
      value={workspaceId ?? ""}
      onChange={(v) => setWorkspaceId(v || null)}
      options={options}
      disabled={isLoading || !!error || options.length === 0}
      placeholder={
        isLoading ? "loading…" : error ? "(error)" : options.length === 0 ? "(none)" : "select…"
      }
      triggerClassName="px-2 py-1.5"
    />
  );
}
