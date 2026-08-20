SHELL := /bin/sh
.DEFAULT_GOAL := help

.PHONY: help install dev test lint build verify preview docker-config docker-build docker-up docker-up-detached docker-status docker-logs docker-down

help:
	@printf '%s\n' \
		'KernelLens Labs commands:' \
		'  make install             Install exact npm dependencies' \
		'  make dev                 Start Vite at http://localhost:5173' \
		'  make test                Run unit tests' \
		'  make lint                Run ESLint' \
		'  make build               Create the production bundle' \
		'  make verify              Run test, lint, and build gates' \
		'  make preview             Preview the production bundle' \
		'  make docker-config       Validate the Compose configuration' \
		'  make docker-build        Build the production container image' \
		'  make docker-up           Build and run the container in foreground' \
		'  make docker-up-detached  Build and run the container in background' \
		'  make docker-status       Show container and health status' \
		'  make docker-logs         Follow container logs' \
		'  make docker-down         Stop and remove the Compose container'

install:
	npm ci

dev:
	npm run dev -- --host 0.0.0.0

test:
	npm test

lint:
	npm run lint

build:
	npm run build

verify: test lint build

preview:
	npm run preview -- --host 0.0.0.0

docker-config:
	docker compose config --quiet

docker-build:
	docker compose build

docker-up:
	docker compose up --build

docker-up-detached:
	docker compose up --build --detach

docker-status:
	docker compose ps

docker-logs:
	docker compose logs --follow

docker-down:
	docker compose down
