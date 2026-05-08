-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Gold: Life UW Risk Summary
-- MAGIC
-- MAGIC Period-level summary of life UW risk (one row per reporting_period)
-- MAGIC for use by Reports/Monitor pages.

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `3_qrt_life_uw_risk_summary`(
  CONSTRAINT total_positive    EXPECT (total_life_uw_scr > 0)        ON VIOLATION FAIL UPDATE
)
COMMENT 'Life UW SCR — one row per reporting period with sub-module breakdown'
AS
SELECT
  reporting_period,
  ROUND(MAX(CASE WHEN template_row_id = 'L0010' THEN amount_eur END), 2) AS mortality_eur,
  ROUND(MAX(CASE WHEN template_row_id = 'L0020' THEN amount_eur END), 2) AS longevity_eur,
  ROUND(MAX(CASE WHEN template_row_id = 'L0030' THEN amount_eur END), 2) AS lapse_eur,
  ROUND(MAX(CASE WHEN template_row_id = 'L0040' THEN amount_eur END), 2) AS expense_eur,
  ROUND(MAX(CASE WHEN template_row_id = 'L0050' THEN amount_eur END), 2) AS life_cat_eur,
  ROUND(MAX(CASE WHEN template_row_id = 'L0100' THEN amount_eur END), 2) AS total_life_uw_scr,
  ROUND(MAX(CASE WHEN template_row_id = 'L0110' THEN amount_eur END), 2) AS diversification_benefit_eur
FROM LIVE.`3_qrt_life_uw_risk`
GROUP BY reporting_period
