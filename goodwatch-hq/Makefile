# server environment

.PHONY: upgrade
upgrade:
	@echo "Upgrading to latest windmill version..."
	docker compose down && docker compose pull && docker compose build && docker compose up -d

.PHONY: upgrade-all
upgrade-all:
	@echo "Upgrading to latest windmill version on all hosts..."
	cd orchestrator
	ansible-playbook -i hosts.ini upgrade.yml
