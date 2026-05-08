# Solvency II QRT Demo — Composite Insurer

Databricks-based demo generating synthetic data for a **mid-size European composite insurer** (life + non-life on one balance sheet) and producing EIOPA-aligned Quantitative Reporting Templates (QRT):

- **S.06.02** — List of Assets
- **S.05.01** — Premiums, Claims and Expenses by Line of Business (non-life)
- **S.12.01** — Life and Health (SLT) Technical Provisions
- **S.25.01** — Solvency Capital Requirement (Standard Formula, full composite BSCR)
- **S.26.06** — Non-Life Underwriting Risk (with Igloo stochastic engine)
- **Life UW Risk** — composite life UW SCR (mortality, longevity, lapse, expense, life cat) via the Prophet mock engine

## Architecture

```
Bronze (synthetic source data)
  └→ Silver (cleansed/aggregated)
       └→ Gold (EIOPA QRT format)

Stochastic engines (mocked):
  - Igloo: NL catastrophe risk (per-peril VaR / TVaR)
  - Prophet: Life UW sub-modules (per-LoB VaR / TVaR)
```

Output tables are designed for consumption by external reporting tools (e.g., Tagetik) via JDBC/ODBC or CSV export. The Databricks App (`src/app`) layers a multi-user audit + reporting UI on top.

## Bundle targets

The repo ships two parallel deployment targets so the live demo workspace stays untouched while next-gen work proceeds in dev:

| Target    | Workspace                          | Catalog                       | Schema                | Notes |
| --------- | ---------------------------------- | ----------------------------- | --------------------- | ----- |
| `dev`     | `fevm-lr-serverless-aws-us`        | `lr_serverless_aws_us_catalog`| `solvency2demo_agentic` | Frozen — the live demo |
| `dev_v2`  | `fevm-lr-dev-aws-us`               | `lr_dev_aws_us_catalog`       | `solvency2demo_v2`    | Composite next-gen — active dev |

Override via `databricks bundle deploy -t <target>` or pass `--var catalog_name=...`.

## Setup

Requires [Databricks CLI](https://docs.databricks.com/dev-tools/cli/index.html) v0.200+ with Asset Bundles support. All jobs use **serverless compute** — no cluster configuration needed.

```bash
# Validate
databricks bundle validate -t dev_v2

# Deploy
databricks bundle deploy -t dev_v2

# Run end-to-end
databricks bundle run qrt_pipeline -t dev_v2
```

For a guided one-shot deploy (catalog/schema configurable, app + grants included) use `bash deploy_demo.sh --catalog … --schema …`.

### Cleanup

```bash
databricks bundle destroy -t dev_v2 --auto-approve
```

## Repository Structure

```
├── databricks.yml                     # DAB bundle (variables + targets)
├── resources/
│   ├── qrt_s0501_pipeline.yml         # Non-life P&L
│   ├── qrt_s0602_pipeline.yml         # Asset register
│   ├── qrt_s2501_pipeline.yml         # SCR (composite)
│   ├── qrt_s2606_pipeline.yml         # NL UW risk + Igloo
│   ├── qrt_s1201_pipeline.yml         # Life Technical Provisions
│   └── qrt_life_uw_risk_pipeline.yml  # Life UW risk + Prophet
├── src/
│   ├── 00_Generate_Data/              # Synthetic data + bootstrap + teardown
│   ├── 01_QRT_S0602_Assets/           # silver + gold
│   ├── 02_QRT_S0501_PnL/              # silver + gold
│   ├── 03_QRT_S2501_SCR/              # MLflow standard-formula model + run
│   ├── 04_QRT_S2606_NL_Risk/          # silver + gold + Igloo notebook
│   ├── 04b_QRT_Life_UW_Risk/          # silver + gold + Prophet notebook
│   ├── 05_QRT_S1201_Life_TPs/         # silver + gold
│   └── app/                           # FastAPI + React app
└── deploy_demo.sh                     # Guided deploy script
```

## Variables

| Variable             | Default                | Description |
| -------------------- | ---------------------- | ----------- |
| `catalog_name`       | `main`                 | Unity Catalog (override per target) |
| `schema_name`        | `solvency2demo`        | Schema for all demo tables |
| `entity_name`        | `Bricksurance SE`      | Synthetic undertaking name |
| `entity_lei`         | `5493001KJTIIGC8Y1R12` | Synthetic LEI |
| `entity_type`        | `composite`            | `composite`, `life`, or `nonlife` |
| `reporting_date`     | `2025-12-31`           | Reference date |

## Mocked actuarial engines

The demo uses two parallel mock engines that mirror the integration pattern with external actuarial software:

- **Igloo** (`src/04_QRT_S2606_NL_Risk/run_igloo_model.py`) — non-life cat risk by peril/LoB
- **Prophet** (`src/04b_QRT_Life_UW_Risk/run_prophet_model.py`) — life UW SCR sub-modules

Both follow the same handoff pattern:
1. Export inputs to a UC Volume as CSV
2. Simulated engine run (sleep + log progress)
3. Read pre-generated mock results, write to Volume, re-import to a Delta table
4. Log audit metadata (run ID, file paths, timestamps, status)

## Internal — Q4 2025 engineered pains (do NOT include in demo narrative)

The Q4 2025 quarter carries six deliberate operational pains for the demo to surface. Q1–Q3 stay clean to make the contrast visible.

| Pain | Where | Discoverable via |
| ---- | ----- | ---------------- |
| **A** RI feed late by 8 business days | `5_mon_pipeline_sla_status.feed_received_timestamp` for `1_raw_reinsurance` (t+11 only in Q4) | Control Tower freshness check |
| **B** Claims DQ break — 47 negative paid_amount | `1_raw_claims` rows tagged `system_source = 'legacy_pre_migration'` | DLT expectation drops them; clue in the system_source field |
| **C** December storm — property reserve spike | 60% of property claims clustered Dec 18–31; `event_id = 'storm_dec_2025'`; +18% Q4 BEL | Storm-tag aggregation + reserve trend |
| **D** Life lapse deterioration | Unit-linked lapse rate ×1.35 in Q4 only → ~+2.3% Q4 life BEL | `1_raw_life_lapses` quarter-on-quarter |
| **E** €2.3M asset/own-funds gap | Duplicate ISIN custodian bond in `1_raw_assets` (Q4) | `5_mon_cross_qrt_reconciliation.s0602_vs_own_funds_plus_liabilities` |
| **F** Champion vs Challenger +4% SCR | `params_2026` in `register_standard_formula_model.py` (NL UW corr +1.5%, op risk → 4%, life lapse stress ×1.15) | Champion vs Challenger SCR side-by-side |

A BaFin question fixture (`0_cfg_bafin_questions`) carries the regulator inquiry that follows submission and ties to Pain C.
