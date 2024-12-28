# server environment

.PHONY: upgrade-default
upgrade-default:
	@echo "Upgrading default workers to latest windmill version..."
	cd default
	docker compose down && docker compose pull && docker compose build && docker compose up -d

.PHONY: upgrade-highperf
upgrade:
	@echo "Upgrading highperf workers to latest windmill version..."
	cd highperf
	docker compose down && docker compose pull && docker compose build && docker compose up -d
