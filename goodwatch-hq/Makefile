# server environment

.PHONY: upgrade-windmill
upgrade-windmill:
	@echo "Upgrading to latest windmill version on all hosts..."
	cd ansible && ansible-playbook -i hosts.ini upgrade.yml

.PHONY: setup-cronjobs
setup-cronjobs:
	@echo "Setting up cronjobs on all hosts..."
	cd ansible && ansible-playbook -i hosts.ini cron.yml

.PHONY: secure-vpn
secure-vpn:
	@echo "Auditing VPN security..."
	cd ansible && ansible-playbook -i hosts.ini secure-vpn.yml
