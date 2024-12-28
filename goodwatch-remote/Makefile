# server environment

.PHONY: upgrade
upgrade:
	@echo "Upgrading default workers to latest windmill version..."
	docker compose down && docker compose pull && docker compose build && docker compose up -d

.PHONY: upgrade-highperf
upgrade-highperf:
	@echo "Upgrading highperf workers to latest windmill version..."
	docker compose -f docker-compose.highperf.yml down && docker compose -f docker-compose.highperf.yml pull && docker compose -f docker-compose.highperf.yml build && docker compose -f docker-compose.highperf.yml up -d
