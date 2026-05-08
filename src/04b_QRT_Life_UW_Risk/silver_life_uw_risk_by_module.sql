-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Silver: Life UW Risk by Sub-Module
-- MAGIC
-- MAGIC Aggregates Prophet stochastic output to the life UW SCR sub-modules
-- MAGIC (mortality, longevity, lapse, expense, life_cat) per LoB.
-- MAGIC
-- MAGIC **Source:** `prophet_run_results` (life stochastic engine output)
-- MAGIC **Target:** `2_stg_life_uw_risk_by_module`

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `2_stg_life_uw_risk_by_module`(
  CONSTRAINT var_non_negative   EXPECT (var_eur >= 0)             ON VIOLATION DROP ROW,
  CONSTRAINT tvar_gte_var       EXPECT (tvar_eur >= var_eur)      ON VIOLATION DROP ROW,
  CONSTRAINT submodule_known    EXPECT (sub_module IN ('mortality','longevity','lapse','expense','life_cat')) ON VIOLATION DROP ROW
)
COMMENT 'Life UW SCR sub-module charges per LoB at 1-in-200 (Prophet stochastic output)'
AS
SELECT
    reporting_period,
    lob_code,
    lob_name,
    sub_module,
    CAST(var_eur AS DOUBLE)  AS var_eur,
    CAST(tvar_eur AS DOUBLE) AS tvar_eur,
    model_version
FROM LIVE.prophet_run_results
