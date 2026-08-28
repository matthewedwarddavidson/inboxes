# Inboxes — common tasks
#
# Quick start:  make start   (installs deps if needed, then runs the dev server)

.DEFAULT_GOAL := help
.PHONY: help start dev install build preview test test-watch typecheck clean

NPM ?= npm

node_modules: package.json
	$(NPM) install
	@touch node_modules

## start: install deps (if needed) and launch the dev server
start: node_modules
	$(NPM) run dev

## dev: alias for start
dev: start

## install: install dependencies
install:
	$(NPM) install

## build: type-check and build the production bundle
build: node_modules
	$(NPM) run build

## preview: serve the production build locally
preview: build
	$(NPM) run preview

## test: run the test suite once
test: node_modules
	$(NPM) run test

## test-watch: run tests in watch mode
test-watch: node_modules
	$(NPM) run test:watch

## typecheck: run the TypeScript type checker
typecheck: node_modules
	$(NPM) run typecheck

## clean: remove build output and installed dependencies
clean:
	rm -rf node_modules dist

## help: show available commands
help:
	@echo "Inboxes — available commands:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
