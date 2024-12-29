# server environment

.PHONY: upgrade
upgrade:
	@echo "Upgrading workers to latest windmill version..."
	cd default
	docker compose pull && docker compose build && docker compose down && docker compose up -d
