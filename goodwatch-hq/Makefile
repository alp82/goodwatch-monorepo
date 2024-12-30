# server environment

.PHONY: upgrade-windmill
upgrade-windmill:
	@echo "Upgrading to latest windmill version on all hosts..."
	cd ansible && ansible-playbook -i hosts.ini upgrade.yml

.PHONY: setup-cronjobs
setup-cronjobs:
	@echo "Setting up cronjobs on all hosts..."
	cd ansible && ansible-playbook -i hosts.ini cron.yml

.PHONY: secure-vps
secure-vps:
	@echo "Auditing VPS security..."
	cd ansible && ansible-playbook -i hosts.ini secure-vps.yml
