# server environment

.PHONY: upgrade
upgrade:
	@echo "Upgrading to latest windmill version..."
	docker compose down && docker compose pull && docker compose build && docker compose up -d
