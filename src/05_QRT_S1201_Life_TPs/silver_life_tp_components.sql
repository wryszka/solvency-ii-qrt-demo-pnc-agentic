-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Silver: Life Technical Provisions Components
-- MAGIC
-- MAGIC Joins life reserves (BEL, RM) with assumption metadata to produce
-- MAGIC a per-LoB technical-provisions component view that the S.12.01 gold
-- MAGIC layer maps to EIOPA cell references.
-- MAGIC
-- MAGIC **Source:** `1_raw_life_reserves`, `1_raw_life_assumptions`
-- MAGIC **Target:** `2_stg_life_tp_components`

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `2_stg_life_tp_components`(
  CONSTRAINT bel_non_negative   EXPECT (best_estimate_liability_eur >= 0)  ON VIOLATION DROP ROW,
  CONSTRAINT rm_non_negative    EXPECT (risk_margin_eur >= 0)              ON VIOLATION DROP ROW,
  CONSTRAINT lob_present        EXPECT (lob_code IS NOT NULL)              ON VIOLATION DROP ROW
)
COMMENT 'Life technical provisions components per LoB (BEL + RM with assumption metadata)'
AS
SELECT
    r.reporting_period,
    r.lob_code,
    r.lob_name,
    r.lob_eiopa_name,
    r.in_force_count,
    CAST(r.best_estimate_liability_eur AS DOUBLE) AS best_estimate_liability_eur,
    CAST(r.risk_margin_eur            AS DOUBLE) AS risk_margin_eur,
    CAST(r.technical_provisions_eur   AS DOUBLE) AS technical_provisions_eur,
    -- Gross of reinsurance (we treat life reinsurance as 0 in this demo)
    CAST(r.best_estimate_liability_eur AS DOUBLE) AS bel_gross_of_reinsurance,
    CAST(0.0                            AS DOUBLE) AS reinsurance_recoverables,
    CAST(r.best_estimate_liability_eur AS DOUBLE) AS bel_net_of_reinsurance,
    r.assumption_version,
    r.discount_curve_source
FROM LIVE.`1_raw_life_reserves` r
