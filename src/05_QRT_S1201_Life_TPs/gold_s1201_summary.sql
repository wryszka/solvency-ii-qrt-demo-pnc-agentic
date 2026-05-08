-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Gold: S.12.01 — Period summary
-- MAGIC
-- MAGIC One row per reporting_period with the totals across the life book.
-- MAGIC Convenient for Reports / Monitor / Process Overview pages.

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `3_qrt_s1201_summary`(
  CONSTRAINT total_tp_positive EXPECT (total_technical_provisions_eur > 0) ON VIOLATION FAIL UPDATE
)
COMMENT 'S.12.01 — period-level summary of life technical provisions'
AS
SELECT
  reporting_period,
  COUNT(DISTINCT lob_code) AS lobs_with_tp,
  ROUND(SUM(best_estimate_liability_eur), 2)     AS total_best_estimate_liability_eur,
  ROUND(SUM(risk_margin_eur), 2)                  AS total_risk_margin_eur,
  ROUND(SUM(technical_provisions_eur), 2)         AS total_technical_provisions_eur,
  ROUND(SUM(reinsurance_recoverables), 2)         AS total_reinsurance_recoverables_eur,
  ROUND(SUM(bel_net_of_reinsurance), 2)           AS total_bel_net_of_reinsurance_eur
FROM LIVE.`2_stg_life_tp_components`
GROUP BY reporting_period
