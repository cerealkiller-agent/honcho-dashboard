# Honcho 3.2.2 compatibility and upgrade guide

## Compatibility decision

No dashboard runtime or dependency change is required for Honcho 3.2.2.
The comparison of the immutable `v3.2.1` and `v3.2.2` tags shows:

- `docs/v3/openapi.json` changes only `info.version`.
- `src/schemas/api.py` and the TypeScript SDK tree are unchanged. The tagged SDK
  remains **2.5.1**, which is already installed and locked by the dashboard.
- `src/telemetry/events/trace.py` and `src/telemetry/trace_exporter.py` are unchanged.
  The dashboard's supported `llm.call.traced` and `embedding.call.traced` events
  still use schema v2, with v1 archives still supported.
- Existing version gates enable scopes, workspace chat, evidence, provenance,
  and service backlog on 3.2.2 without a new capability or speculative request.

Honcho 3.2.2 compatibility itself requires no dashboard runtime or dependency
changes. Dashboard 1.2.2 includes this review's regression coverage and operator
guidance alongside the workspace-navigation fix. The
[3.2.1 compatibility matrix](HONCHO_3_2_1_VALIDATION.md) still applies, including
older-server attribution handling and unknown/restricted capability states.

## Server changes and dashboard impact

| Honcho change | Dashboard impact |
| --- | --- |
| Peer-session lookup index | Peer-session reads, including peer session counts, benefit after the server migration. Request and pagination shapes are unchanged. |
| Oversized context `search_query` truncation | Server-side fix to peer context, peer representation, and session context. The Context page does not currently submit a search query. Do not add a client-side 8192-character limit: the server setting is a configurable token cap. |
| Redis connection retries and idle reconnect | Server reliability improvements. No dashboard retry policy or configuration change is required. |
| Deriver prompt/schema rules | Changes future server extraction behavior, not the public conclusion response schema or dashboard rendering. |
| Langfuse span timing, tool payloads, and Agent Graph | Server exporter and Langfuse features, not new Honcho dashboard API endpoints. See the observability boundary below. |
| Sentry transient-error suppression | Server-side reporting policy. Do not hide failed call attempts from the dashboard's trace reader or suppress terminal API failures. |

## Observability boundary

Honcho now feeds Langfuse through its captured-call exporter only. Run observations
are typed `agent`, generation output retains tool arguments and thinking, and
executed tool spans include results and duration. The new captured run/step/tool
lifecycle records are dispatched to span-tree exporters. They do not introduce a
new CloudEvents trace schema or a public Agent Graph endpoint.

The dashboard's **CALL_TRACES** panel is a separate, metadata-only view of a
collector's CloudEvents JSONL export, configured with `HONCHO_TRACE_FILE` on the
**dashboard host**. It does not query Langfuse. It already displays recorded call
latency, outcomes, attempts, correlation IDs, and content references. It does not
expose prompts, tool arguments/results, thinking payloads, or signatures, and it
does not resolve content references. Keep this privacy boundary intact.

The Sentry change suppresses per-attempt provider 5xx/connection events from the
Anthropic, OpenAI, and Google GenAI SDK integrations. Honcho reports the final
failure when retries are exhausted. Client errors such as 400, 401, 404, and 429
are still reported. This does not mean an unsuccessful attempt should disappear
from a call trace when a later attempt succeeds.

### Configuration caveats

- **Langfuse requires `TELEMETRY_ENABLED=true` on Honcho**, in addition to its
  normal Langfuse credentials/configuration. Langfuse keys alone with telemetry
  disabled no longer produce traces. Review the configured telemetry destination
  before enabling this master switch.
- `LANGFUSE_EXPORTER_MODE` was removed. A leftover value, including `inline`, is
  ignored. Remove it from the Honcho deployment configuration to avoid confusion.
- CloudEvents payload tracing is a separate opt-in
  (`TELEMETRY_TRACE_PAYLOADS_ENABLED`) and needs a configured collector/export.
  Enabling Langfuse alone does not populate `HONCHO_TRACE_FILE`.
- Collector payloads can contain sensitive content even though the dashboard
  excludes it. Restrict collector access and mount its export read-only.
- The dashboard's trace file does not follow the selected API instance. Check
  source/workspace metadata when diagnosing a fleet with multiple instances.

## Upgrade procedure

1. Back up the Honcho database and deployment configuration. Schedule a maintenance
   window for the new `b8d2f4a6c9e1` migration, which adds
   `ix_session_peers_workspace_peer` on
   `session_peers (workspace_name, peer_name, session_name)`. The index is **not
   built concurrently**, so writes to `session_peers` wait while it builds.
2. Upgrade API and deriver to the same immutable `v3.2.2` tag and run Honcho's
   normal migration procedure. This dashboard does not run migrations or upgrade
   those services.
3. Review the Langfuse settings above if that integration is used. Redis's new
   `CACHE_CONNECT_TIMEOUT_SECONDS` (default 5) and `CACHE_CONNECT_RETRIES`
   (default 3) belong on Honcho, not the dashboard. Overrides are not required
   just to use this release.
4. Reload the dashboard to refresh version capabilities. Confirm `/health` is
   healthy and `/openapi.json` reports 3.2.2. Smoke-test peer session counts,
   Context with and without a scope, search, peer/workspace chat, opt-in evidence,
   provenance, and Fleet/Reasoning backlog against the upgraded server.
5. If Langfuse is configured, inspect a new dialectic/dreamer run there for Agent
   Graph placement, timing, and tool results. If a collector is configured,
   separately check **CALL_TRACES** for metadata-only records. Neither a dashboard
   fixture nor a successful chat proves the Langfuse/Sentry integrations work.

## Verification

From `site/` with Node 24+:

```sh
npm run check
npm run start -- --hostname 127.0.0.1 --port 3108
# In another terminal, choose an output directory outside the repository:
DASHBOARD_TEST_URL=http://127.0.0.1:3108 \
DASHBOARD_TEST_OUTPUT="$TMPDIR/honcho322-dashboard-review" \
node scripts/verify-honcho32-ui.mjs
```

The contract matrix includes 3.0.12, 3.1.0, 3.1.2, 3.2.0, 3.2.1, and 3.2.2.
The synthetic browser suite includes desktop/mobile 3.2.2 alongside 3.2.0/3.2.1,
plus older/unknown-version feature restrictions. Trace tests retain content
references while excluding tool/thinking payloads and keep failed/recovered
attempts visible independently of Sentry's reporting policy.

### Local results, 2026-10-01

- The dashboard 1.2.2 release-preparation rerun of `npm run check` passed on
  Node 26.7.0: **45 tests**, type checking, and the production build. Seven
  pre-existing lint warnings remain. Node module-type/deprecation and Next.js
  workspace-root warnings did not prevent the checks from passing.
- The synthetic browser suite passed against the production build for
  **3.2.0/3.2.1/3.2.2 on desktop and mobile**, including evidence attribution,
  read-only message retrieval/retry, provenance, backlog, trace details,
  empty/error states, and older/unknown-version restrictions. It recorded no
  unexpected requests, JavaScript exceptions, or page overflow.
- The workspace-navigation regression suite passed **30 desktop/mobile checks**
  against the production build, including pinned links, cross-tab changes,
  read-only peer requests, and peer-row destination workspace selection.
  All data requests were intercepted, with no unexpected requests or runtime errors.
- Parsed upstream OpenAPI documents are identical after removing `info.version`.
  Git object comparisons also confirmed unchanged SDK, API schema, and
  CloudEvents trace schema/exporter files between the two release tags.

These are source/fixture checks, not live Honcho 3.2.2, Langfuse, or Sentry
integration verification. No live server settings, data, or migrations were changed.

## Sources

- [Honcho v3.2.2 release](https://github.com/plastic-labs/honcho/releases/tag/v3.2.2)
- [Tag comparison](https://github.com/plastic-labs/honcho/compare/v3.2.1...v3.2.2)
- [Tagged OpenAPI](https://github.com/plastic-labs/honcho/blob/v3.2.2/docs/v3/openapi.json)
- [Tagged SDK manifest](https://github.com/plastic-labs/honcho/blob/v3.2.2/sdks/typescript/package.json)
- [Index migration](https://github.com/plastic-labs/honcho/blob/v3.2.2/migrations/versions/b8d2f4a6c9e1_index_session_peers_by_peer.py)
- [Trace event schemas](https://github.com/plastic-labs/honcho/blob/v3.2.2/src/telemetry/events/trace.py)
- [Captured-call and span dispatch](https://github.com/plastic-labs/honcho/blob/v3.2.2/src/llm/capture.py)
- [Telemetry initialization](https://github.com/plastic-labs/honcho/blob/v3.2.2/src/telemetry/events/__init__.py)
- [Sentry filtering](https://github.com/plastic-labs/honcho/blob/v3.2.2/src/telemetry/sentry.py)
