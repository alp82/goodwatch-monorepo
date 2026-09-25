"""Crate row models ignore unknown keyword arguments, so a misspelt field is
silently dropped and its column stays NULL. Check every literal keyword passed
to a Crate row model against the model's fields."""
import ast
import inspect
import sys
import unittest
from pathlib import Path

from pydantic import BaseModel

WINDMILL = Path(__file__).parents[1] / "windmill"
sys.path.insert(0, str(WINDMILL))

from f.sync.models import crate_models

MODELS = {
    name: model for name, model in inspect.getmembers(crate_models, inspect.isclass)
    if issubclass(model, BaseModel) and model.__module__ == crate_models.__name__
}
# Callers that pick the model at runtime.
ALIASES = {"MediaClass": ("Movie", "Show")}


class CrateModelKeywordTests(unittest.TestCase):
    def test_crate_rows_are_built_only_from_model_fields(self):
        unknown = []
        for path in sorted((WINDMILL / "f").rglob("*.py")):
            source = path.read_text()
            if "crate_models" not in source:
                continue
            for node in ast.walk(ast.parse(source)):
                if not isinstance(node, ast.Call):
                    continue
                func = node.func
                name = func.id if isinstance(func, ast.Name) else getattr(func, "attr", None)
                models = [MODELS[alias] for alias in ALIASES.get(name, (name,)) if alias in MODELS]
                for model in models:
                    for keyword in node.keywords:
                        if keyword.arg and keyword.arg not in model.model_fields:
                            unknown.append(
                                f"{path.relative_to(WINDMILL)}:{node.lineno} "
                                f"{model.__name__}({keyword.arg}=)"
                            )
        self.assertEqual(unknown, [])


if __name__ == "__main__":
    unittest.main()
