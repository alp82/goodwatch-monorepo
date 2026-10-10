# How and when to run these: docs/sitemap.md.
SITEMAP_DIR := ../public/sitemaps

.PHONY: sitemaps sitemaps-checked sitemaps-test index-record

# Writes the sitemap files straight into public/sitemaps, unchecked.
sitemaps:
	uv run create_sitemaps.py

# The weekly command: writes the files to a temporary directory, checks every listed URL against the live site
# (about 50 minutes), and replaces public/sitemaps only when all of them pass. A failed run changes nothing and
# keeps its files for a look.
sitemaps-checked:
	@set -e; \
	new=$$(mktemp -d); \
	uv run create_sitemaps.py --output-dir "$$new"; \
	if ! uv run check_sitemap_urls.py "$$new"; then \
		echo "Check failed: $(SITEMAP_DIR) is unchanged. The rejected files are in $$new"; \
		exit 1; \
	fi; \
	mkdir -p $(SITEMAP_DIR); \
	rm -f $(SITEMAP_DIR)/sitemap*.xml; \
	cp "$$new"/sitemap*.xml $(SITEMAP_DIR)/; \
	rm -rf "$$new"; \
	echo "Replaced $(SITEMAP_DIR). Review with git diff, then commit and push to main."

sitemaps-test:
	python3 -m unittest test_sitemap_query test_sitemap_lastmod test_check_sitemap_urls

# Weekly, by hand. See docs/research/discovery-search/index-record.md.
index-record:
	uv run gsc_sample.py
