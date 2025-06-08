# local environment

.PHONY: activate
activate:
	@echo "Activating goodwatch workspace..."
	wmill workspace switch goodwatch

.PHONY: pull
pull: activate
	@echo "Pulling data from goodwatch workspace..."
	cd windmill && wmill sync pull --raw

.PHONY: push
push: activate
	@echo "Pushing data to goodwatch workspace..."
	cd windmill && wmill sync push --raw
