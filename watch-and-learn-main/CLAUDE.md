# Claude Code Instructions

## Linting Requirements

**IMPORTANT**: Always run these linting tools after making any changes to Python code in `services/python-agent/`:

### 1. Ruff (Linting & Formatting)

```bash
cd services/python-agent && uvx ruff check --fix .
```

### 2. ty (Type Checking)

```bash
cd services/python-agent && uvx ty check .
```