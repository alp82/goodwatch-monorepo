# local environment

WMILL := npx --yes windmill-cli@latest

.PHONY: activate
activate:
	@echo "Activating goodwatch workspace..."
	$(WMILL) workspace switch goodwatch

.PHONY: pull
pull: activate
	@echo "Pulling data from goodwatch workspace..."
	cd windmill && $(WMILL) sync pull --raw

.PHONY: push
push: activate
	@echo "Pushing data to goodwatch workspace..."
	cd windmill && $(WMILL) sync push --raw
