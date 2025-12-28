# Testing commands for InvestIA project
# Run 'make help' to see all available commands

.PHONY: test test-watch test-coverage test-ui test-quick test-debug

test:
	npx vitest run

test-watch:
	npx vitest --watch

test-coverage:
	npx vitest run --coverage

test-ui:
	npx vitest --ui

test-quick:
	npx vitest run --reporter=verbose

test-debug:
	npx vitest --inspect-brk --watch

.DEFAULT_GOAL := help
help:
	@echo "Available commands:"
	@echo "  make test          - Run tests once"
	@echo "  make test-watch    - Run tests in watch mode"
	@echo "  make test-coverage - Generate coverage report"
	@echo "  make test-ui       - Open Vitest UI"
	@echo "  make test-quick    - Run tests with verbose output"
	@echo "  make test-debug    - Run tests with debugger attached"
