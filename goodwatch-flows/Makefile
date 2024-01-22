# local environment

.PHONY: activate
activate:
	@echo "Activating flickvibe workspace..."
	wmill workspace switch flickvibe

.PHONY: pull
pull: activate
	@echo "Pulling data from flickvibe workspace..."
	cd windmill && wmill sync pull --raw

.PHONY: push
push: activate
	@echo "Pushing data to flickvibe workspace..."
	cd windmill && wmill sync push --raw
