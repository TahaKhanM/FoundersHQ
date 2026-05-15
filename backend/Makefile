.PHONY: verify lint typecheck test install

install:
	pip install -e ".[dev]"

lint:
	ruff check .

typecheck:
	mypy app

test:
	pytest -x --tb=short -m "not integration"

test-integration:
	pytest -x --tb=short -m integration

verify: lint typecheck test
