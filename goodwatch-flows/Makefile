# local environment

WMILL := npx --yes windmill-cli@latest
WMILL_WORKSPACE := goodwatch
WMILL_REMOTE := https://10.0.0.10:9000

.PHONY: configure
configure:
	@echo "Configuring goodwatch workspace..."
	$(WMILL) workspace add $(WMILL_WORKSPACE) $(WMILL_WORKSPACE) $(WMILL_REMOTE)

.PHONY: activate
activate:
	@echo "Activating goodwatch workspace..."
	$(WMILL) workspace switch $(WMILL_WORKSPACE)
	$(WMILL) workspace whoami

.PHONY: pull
pull: activate
	@echo "Pulling data from goodwatch workspace..."
	cd windmill && $(WMILL) sync pull

.PHONY: push
push: activate
	@echo "Pushing data to goodwatch workspace..."
	cd windmill && $(WMILL) sync push
