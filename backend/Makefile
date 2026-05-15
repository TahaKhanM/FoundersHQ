.PHONY: verify lint typecheck test install

install:
	pip install -e ".[dev]"

lint:
	ruff check .

typecheck:
	mypy app

test:
	pytest -x --tb=short

verify: lint typecheck test
