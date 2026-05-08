-- Databricks notebook source
-- MAGIC %md
-- MAGIC # Gold: Life UW Risk Template
-- MAGIC
-- MAGIC Aggregates the Prophet life UW sub-modules (mortality, longevity, lapse,
-- MAGIC expense, life_cat) into a single life UW SCR per period using the EIOPA
-- MAGIC standard formula life UW correlation matrix.
-- MAGIC
-- MAGIC EIOPA Annex IV life UW correlations:
-- MAGIC ```
-- MAGIC                mortality longevity lapse expense life_cat
-- MAGIC mortality       1.00      -0.25     0.00  0.25    0.25
-- MAGIC longevity      -0.25       1.00     0.25  0.25    0.00
-- MAGIC lapse           0.00       0.25     1.00  0.50    0.25
-- MAGIC expense         0.25       0.25     0.50  1.00    0.25
-- MAGIC life_cat        0.25       0.00     0.25  0.25    1.00
-- MAGIC ```
-- MAGIC
-- MAGIC **Source:** `2_stg_life_uw_risk_by_module`
-- MAGIC **Target:** `3_qrt_life_uw_risk`

-- COMMAND ----------

CREATE OR REFRESH MATERIALIZED VIEW `3_qrt_life_uw_risk`(
  CONSTRAINT row_id_present    EXPECT (template_row_id IS NOT NULL)  ON VIOLATION DROP ROW,
  CONSTRAINT amount_not_null   EXPECT (amount_eur IS NOT NULL)       ON VIOLATION DROP ROW
)
COMMENT 'Life UW SCR — sub-modules + diversified total per EIOPA Annex IV correlation'
AS

WITH submodule_totals AS (
  SELECT
    reporting_period,
    SUM(CASE WHEN sub_module = 'mortality' THEN var_eur ELSE 0 END) AS mort,
    SUM(CASE WHEN sub_module = 'longevity' THEN var_eur ELSE 0 END) AS long_,
    SUM(CASE WHEN sub_module = 'lapse'     THEN var_eur ELSE 0 END) AS lapse,
    SUM(CASE WHEN sub_module = 'expense'   THEN var_eur ELSE 0 END) AS expense,
    SUM(CASE WHEN sub_module = 'life_cat'  THEN var_eur ELSE 0 END) AS life_cat
  FROM LIVE.`2_stg_life_uw_risk_by_module`
  GROUP BY reporting_period
),
diversified AS (
  SELECT
    reporting_period,
    mort, long_, lapse, expense, life_cat,
    -- Diversified Life UW = sqrt( sum_i sum_j (corr_ij * x_i * x_j) )
    -- We expand the bilinear form explicitly for readability.
    SQRT(
        mort*mort + long_*long_ + lapse*lapse + expense*expense + life_cat*life_cat
      + 2 * (-0.25) * mort * long_
      + 2 * ( 0.00) * mort * lapse
      + 2 * ( 0.25) * mort * expense
      + 2 * ( 0.25) * mort * life_cat
      + 2 * ( 0.25) * long_ * lapse
      + 2 * ( 0.25) * long_ * expense
      + 2 * ( 0.00) * long_ * life_cat
      + 2 * ( 0.50) * lapse * expense
      + 2 * ( 0.25) * lapse * life_cat
      + 2 * ( 0.25) * expense * life_cat
    ) AS total_life_uw
  FROM submodule_totals
)

SELECT reporting_period, 'L0010' AS template_row_id, 'Mortality risk' AS template_row_label,
       ROUND(mort, 2) AS amount_eur FROM diversified
UNION ALL SELECT reporting_period, 'L0020', 'Longevity risk',  ROUND(long_, 2) FROM diversified
UNION ALL SELECT reporting_period, 'L0030', 'Lapse risk',      ROUND(lapse, 2) FROM diversified
UNION ALL SELECT reporting_period, 'L0040', 'Expense risk',    ROUND(expense, 2) FROM diversified
UNION ALL SELECT reporting_period, 'L0050', 'Life catastrophe risk', ROUND(life_cat, 2) FROM diversified
UNION ALL SELECT reporting_period, 'L0100', 'Total Life UW risk (diversified)',
                  ROUND(total_life_uw, 2) FROM diversified
UNION ALL SELECT reporting_period, 'L0110', 'Diversification benefit',
                  ROUND(total_life_uw - (mort + long_ + lapse + expense + life_cat), 2) FROM diversified
