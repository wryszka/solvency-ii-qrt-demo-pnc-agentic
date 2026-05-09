# Adding a workbench tile

The Actuarial Workbench landing (`/`) shows tiles. Each tile is either **live**
(its own working surface, like Solvency II at `/solvency-2`) or **roadmap** (a
stub page that describes what the workflow would cover and how it would extend
the existing platform).

This doc covers the pattern for adding either kind. The pattern is deliberately
small and disciplined so the workbench keeps the redeployability provisions
established in Phase 6a — no new tile is allowed to re-introduce hardcoded
identifiers, undeclared bundle resources, or non-idempotent setup.

---

## Roadmap tile (the cheap path)

For a workflow you want to advertise but haven't built yet:

1. **Add tile metadata.** Edit `src/app/frontend/src/lib/workbench-tiles.ts` and
   append an entry:

   ```ts
   {
     slug: 'capital-allocation',
     label: 'Capital allocation',
     description: 'One-line description that fits in a tile.',
     status: 'roadmap',
     icon: PieChart,                           // any lucide-react icon
     to: '/roadmap/capital-allocation',
   },
   ```

2. **Add the stub content.** Edit `src/app/frontend/src/lib/roadmap-content.ts`
   and add an entry under the same slug:

   ```ts
   'capital-allocation': {
     what: "What this workflow covers — 1 paragraph, factual, no marketing.",
     workbench_capabilities: [
       "How it would extend the workbench — bullet 1",
       "Bullet 2",
       "Bullet 3",
     ],
     adjacent_links: [
       { label: 'See pattern X already live', to: '/orsa' },
     ],
   },
   ```

3. **Done.** No route registration, no new component file. The existing
   `RoadmapStub.tsx` page handles every roadmap tile via the URL slug.

Visit `/` and the new tile appears in the grid.

---

## Live tile (the disciplined path)

For a workflow that's actually built. **All Phase 6a redeployability provisions
apply** — no exceptions:

1. **Add tile metadata** (same as roadmap, but `status: 'live'` and `to: '/your-slug'`).

2. **Pick a slug + URL prefix.** Live tiles get their own top-level prefix:
   `/solvency-2`, `/pricing`, `/ifrs-17`. Use kebab-case.

3. **Build the surface under that prefix.** New routes go in `App.tsx` either
   at the top level or nested under the prefix. Internal navigation within the
   surface should use absolute paths (`/your-slug/sub`) for clarity.

4. **Update `databricks.yml` if domain-specific variables are needed.** For
   example a separate catalog or schema. Add the variable to the `variables:`
   section with a sensible default. Override per-target if required. **Never**
   hardcode the value in scripts or the app.

5. **Bundle-resource everything new.** Any new UC volume, registered model,
   dashboard, Genie space, or job must be declared in `resources/*.yml` and
   created by `databricks bundle deploy`. If it's not bundle-able (Genie spaces
   today aren't), use the idempotent-script pattern: `lookup-by-name → create
   if absent → update if present → write resulting UUID into a runtime config
   the app can read`.

6. **No version literals.** If your surface uses MLflow models, load by alias
   (`models:/{name}@production`) — never by `version_num=N`. Re-running the
   register notebook on the workspace must not break the alias-loading path.

7. **Idempotent registration.** The register notebook starts with a cheap check
   ("are the canonical versions + aliases already in place?") and exits early
   if so. Multiple deploys must not accumulate model versions.

8. **Deploy + smoke test.**
   ```bash
   bash deploy_demo.sh --catalog YOUR_CATALOG --profile YOUR_PROFILE
   bash scripts/preflight_check.sh --profile YOUR_PROFILE
   ```
   Both must pass green.

9. **Reset Demo.** If the surface has demo state worth resetting, extend
   `_rebase_demo_state` in `src/app/server/routes/demo.py` to handle it.
   Anything seeded gets a deterministic author or `is_demo_seeded` flag so
   Reset can distinguish baseline rows from in-demo creations. **Never use
   hardcoded dates** to filter demo rows.

10. **Document the live cycle** on the tile if useful — e.g. Solvency II shows
    "Live cycle: 2026-Q2". Read this from `/api/demo/period-state` (or the
    surface's equivalent) — never hardcode.

---

## Hard rules — same as Phase 6a

- No hardcoded workspace URLs, catalog names, schema names, warehouse IDs,
  dashboard UUIDs, Genie space UUIDs, model URIs, volume paths, or app names.
- All variables defined once in `databricks.yml`, propagated.
- Bundle-resource declared for every new workspace asset, or idempotent script
  with runtime config write.
- Re-running deploy heals drift; never duplicates.
- All scripts / notebooks read configuration from env (set by `deploy_demo.sh`)
  with no divergent local defaults.
- Any LLM-driven feature uses the `server.ai.generate_review` wrapper so it
  inherits MLflow tracing + endpoint-fallback behaviour.

---

## Examples to reference

- **Roadmap tile:** Pricing — `workbench-tiles.ts` + `roadmap-content.ts` only.
- **Live tile:** Solvency II — full surface across `/solvency-2`, `/today`,
  `/lab/...`, `/orsa/...`, `/overlays`, `/report/...`. Bundle resources in
  `resources/*.yml`. Variables in `databricks.yml`. Idempotency in
  `register_standard_formula_model.py` and `register_reserving_models.py`.
  Reset Demo handling in `src/app/server/routes/demo.py:_rebase_demo_state`.

If you find yourself writing a hardcoded value, a non-idempotent step, or a
new manual click in the deploy flow — stop and ask: how do existing live tiles
avoid this? Answer that, and the same answer applies to your tile.
