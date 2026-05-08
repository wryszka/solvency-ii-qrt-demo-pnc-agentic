-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Gold: S.12.01 — Life and Health (SLT) Technical Provisions
-- MAGIC
-- MAGIC Maps the per-LoB life technical-provisions components to the EIOPA
-- MAGIC S.12.01 template cell references. One row per (reporting_period,
-- MAGIC template_row_id, lob_code).
-- MAGIC
-- MAGIC EIOPA S.12.01 cell mapping (subset used by this demo):
-- MAGIC ```
-- MAGIC C0020  Insurance with profit participation
-- MAGIC C0030  Index-linked and unit-linked insurance
-- MAGIC C0060  Other life insurance (term, whole-of-life)
-- MAGIC C0100  Annuities stemming from non-life insurance contracts
-- MAGIC C0160  Health (similar to life) — Health SLT
-- MAGIC R0010  Technical provisions calculated as a whole
-- MAGIC R0030  Best estimate
-- MAGIC R0100  Recoverable from reinsurance
-- MAGIC R0150  BEL net of reinsurance
-- MAGIC R0210  Risk margin
-- MAGIC R0220  Technical provisions (BEL + RM)
-- MAGIC ```

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `3_qrt_s1201_life_technical_provisions`(
  CONSTRAINT row_id_present     EXPECT (template_row_id IS NOT NULL)  ON VIOLATION DROP ROW,
  CONSTRAINT col_id_present     EXPECT (template_col_id IS NOT NULL)  ON VIOLATION DROP ROW,
  CONSTRAINT amount_not_null    EXPECT (amount_eur IS NOT NULL)       ON VIOLATION DROP ROW
)
COMMENT 'EIOPA S.12.01 Life & Health-SLT Technical Provisions — per LoB by template cell'
AS

WITH lob_to_col AS (
  SELECT 29 AS lob_code, 'C0020' AS template_col_id, 'Insurance with profit participation' AS template_col_label UNION ALL
  SELECT 30, 'C0030', 'Index-linked and unit-linked insurance' UNION ALL
  SELECT 31, 'C0060', 'Other life insurance — Term'           UNION ALL
  SELECT 32, 'C0060', 'Other life insurance — Whole of life'  UNION ALL
  SELECT 33, 'C0100', 'Annuities stemming from non-life'      UNION ALL
  SELECT 34, 'C0160', 'Health (similar to life) — SLT'
),
labelled AS (
  SELECT
    c.reporting_period,
    c.lob_code,
    c.lob_name,
    m.template_col_id,
    m.template_col_label,
    c.best_estimate_liability_eur,
    c.reinsurance_recoverables,
    c.bel_net_of_reinsurance,
    c.risk_margin_eur,
    c.technical_provisions_eur
  FROM LIVE.`2_stg_life_tp_components` c
  JOIN lob_to_col m ON c.lob_code = m.lob_code
)

SELECT reporting_period, 'R0030' AS template_row_id, 'Best estimate (gross)' AS template_row_label,
       lob_code, template_col_id, template_col_label,
       ROUND(best_estimate_liability_eur, 2) AS amount_eur
FROM labelled
UNION ALL SELECT reporting_period, 'R0100', 'Recoverable from reinsurance',
                  lob_code, template_col_id, template_col_label,
                  ROUND(reinsurance_recoverables, 2) FROM labelled
UNION ALL SELECT reporting_period, 'R0150', 'Best estimate net of reinsurance',
                  lob_code, template_col_id, template_col_label,
                  ROUND(bel_net_of_reinsurance, 2) FROM labelled
UNION ALL SELECT reporting_period, 'R0210', 'Risk margin',
                  lob_code, template_col_id, template_col_label,
                  ROUND(risk_margin_eur, 2) FROM labelled
UNION ALL SELECT reporting_period, 'R0220', 'Technical provisions (BEL + RM)',
                  lob_code, template_col_id, template_col_label,
                  ROUND(technical_provisions_eur, 2) FROM labelled
