# Make targets for the Solvency II demo.

.PHONY: help cue-cards.pdf preflight bake-cache deploy-dev

help:
	@echo "  make cue-cards.pdf   — render docs/cue_cards.md to PDF (requires pandoc)"
	@echo "  make preflight       — run scripts/preflight_check.sh"
	@echo "  make bake-cache      — pre-bake AI outputs into 6_ai_demo_cache"
	@echo "  make deploy-dev      — bundle deploy + app deploy to dev_v2"

cue-cards.pdf: docs/cue_cards.md
	@command -v pandoc >/dev/null || { echo "pandoc not installed — install with 'brew install pandoc' (and a TeX engine like basictex/mactex)."; exit 1; }
	pandoc docs/cue_cards.md -o cue-cards.pdf \
	    --pdf-engine=xelatex \
	    -V geometry:a5paper -V geometry:margin=1.5cm \
	    -V mainfont="Helvetica" -V monofont="Menlo" \
	    --highlight-style tango
	@echo "Wrote cue-cards.pdf"

preflight:
	./scripts/preflight_check.sh

bake-cache:
	./scripts/bake_cache.sh

deploy-dev:
	databricks bundle deploy -t dev_v2 --profile DEV
	databricks apps deploy solvency2-qrt-ai-dev \
	    --source-code-path "/Workspace/Users/$$USER@databricks.com/.bundle/solvency-ii-qrt-demo/dev_v2/files/src/app" \
	    --profile DEV
