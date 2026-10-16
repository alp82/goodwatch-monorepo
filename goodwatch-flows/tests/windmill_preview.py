"""Shared helpers for opt-in, inert Windmill flow previews."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).parents[1] / "windmill"
API = os.environ.get("TEST_WINDMILL_API")
TOKEN = os.environ.get("TEST_WINDMILL_TOKEN")


def load_flow(path):
    """Resolve local inline files exactly as the CLI does before API submission."""
    import yaml

    directory = ROOT / (path + ".flow")

    def resolve(value):
        if isinstance(value, dict):
            return {key: resolve(item) for key, item in value.items()}
        if isinstance(value, list):
            return [resolve(item) for item in value]
        if isinstance(value, str) and value.startswith("!inline "):
            return (directory / value.removeprefix("!inline ")).read_text()
        return value

    return resolve(yaml.safe_load((directory / "flow.yaml").read_text()))


def api(path, body=None):
    request = Request(
        API.rstrip("/") + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    with urlopen(request, timeout=30) as response:
        data = response.read().decode()
        try:
            return json.loads(data)
        except ValueError:
            return data


def inert_modules(modules):
    for module in modules:
        value = module["value"]
        if value["type"] == "branchall":
            for branch in value["branches"]:
                inert_modules(branch["modules"])
        elif value["type"] in ("script", "flow", "rawscript"):
            path = value.get("path", module.get("summary", module["id"]))
            module["value"] = {
                "type": "rawscript", "language": "python3", "lock": "",
                "input_transforms": {},
                "content": "def main():\n    return " + repr({"called": path}) + "\n",
            }
        else:
            raise ValueError("Unsupported module type: " + value["type"])
