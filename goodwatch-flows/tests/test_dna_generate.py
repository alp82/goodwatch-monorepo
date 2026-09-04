import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch


FETCH_PATH = (
    Path(__file__).parents[1] / "windmill" / "f" / "dna" / "generate" / "fetch.py"
)


class FakeApiError(Exception):
    def __init__(self, code, details):
        self.code = code
        self.details = details
        super().__init__(f"{code}: {details}")


class FakeAnalysis:
    def __init__(self, value):
        self.value = value

    def model_dump(self):
        return self.value


class FakeTypeAdapter:
    def __init__(self, _schema):
        pass

    def validate_json(self, value):
        return [FakeAnalysis(item) for item in json.loads(value)]


class FakeGenerateContentConfig:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class FakeModelsApi:
    def __init__(self, outcomes):
        self.outcomes = outcomes
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self.outcomes[kwargs["model"]].pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class FakeClient:
    outcomes = {}
    instance = None

    def __init__(self, **kwargs):
        self.api_key = kwargs["api_key"]
        self.models = FakeModelsApi(self.outcomes)
        FakeClient.instance = self


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.expiring_values = {}

    def get(self, key):
        if key in self.expiring_values:
            return self.expiring_values[key][0]
        return self.values.get(key)

    def incrby(self, key, amount):
        value = int(self.values.get(key, 0)) + amount
        self.values[key] = value
        return value

    def decrby(self, key, amount):
        value = int(self.values.get(key, 0)) - amount
        self.values[key] = value
        return value

    def setex(self, key, ttl, value):
        self.expiring_values[key] = (value, ttl)


class FakeDnaMovie:
    def __init__(self):
        self.original_title = "Test Movie"
        self.release_year = 2026
        self.overview = "A test overview."
        self.popularity = 10.0
        self.llm_model_name = None
        self.dna = None
        self.saved = False

    def save(self):
        self.saved = True


def successful_response():
    content = SimpleNamespace(
        parts=[SimpleNamespace(text=json.dumps([{"essence_text": "result"}]))]
    )
    return SimpleNamespace(
        candidates=[SimpleNamespace(content=content)],
        usage_metadata=SimpleNamespace(
            prompt_token_count=100,
            candidates_token_count=50,
            thoughts_token_count=25,
            total_token_count=175,
        ),
    )


def daily_quota_error():
    return FakeApiError(
        429,
        {
            "error": {
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [
                            {
                                "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"
                            }
                        ],
                    }
                ]
            }
        },
    )


def api_error(code):
    return FakeApiError(code, {"error": {"details": []}})


def load_fetch_module(redis):
    google = ModuleType("google")
    google_genai = ModuleType("google.genai")
    google_genai.Client = FakeClient
    google_genai.types = SimpleNamespace(
        GenerateContentConfig=FakeGenerateContentConfig
    )
    google.genai = google_genai

    pydantic = ModuleType("pydantic")
    pydantic.TypeAdapter = FakeTypeAdapter
    pydantic.ValidationError = type("ValidationError", (Exception,), {})

    wmill = ModuleType("wmill")
    wmill.get_variable = lambda _path: "test-api-key"

    data_source = ModuleType("f.data_source.common")
    data_source.get_document_for_id = lambda *args, **kwargs: None

    mongodb = ModuleType("f.db.mongodb")
    mongodb.init_mongodb = lambda: None
    mongodb.close_mongodb = lambda: None

    redis_module = ModuleType("f.db.redis")
    redis_module.RedisConnector = lambda: SimpleNamespace(get_redis=lambda: redis)

    rediscluster = ModuleType("rediscluster")
    rediscluster.RedisCluster = FakeRedis

    dna_models = ModuleType("f.dna.models")
    dna_models.DnaMovie = FakeDnaMovie
    dna_models.DnaTv = type("DnaTv", (), {})
    dna_models.DNAAnalysis = object

    modules = {
        "google": google,
        "google.genai": google_genai,
        "pydantic": pydantic,
        "wmill": wmill,
        "rediscluster": rediscluster,
        "f": ModuleType("f"),
        "f.data_source": ModuleType("f.data_source"),
        "f.data_source.common": data_source,
        "f.db": ModuleType("f.db"),
        "f.db.mongodb": mongodb,
        "f.db.redis": redis_module,
        "f.dna": ModuleType("f.dna"),
        "f.dna.models": dna_models,
    }
    spec = importlib.util.spec_from_file_location("dna_generate", FETCH_PATH)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module


class GenerateDnaTest(unittest.TestCase):
    def test_daily_quota_exhaustion_falls_back_to_next_supported_model(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        FakeClient.outcomes = {
            "gemini-2.5-flash": [daily_quota_error()],
            "gemini-3.6-flash": [successful_response()],
        }

        result = fetch.generate_dna([movie])

        self.assertEqual(result, [{"essence_text": "result"}])
        self.assertEqual(
            [call["model"] for call in FakeClient.instance.models.calls],
            ["gemini-2.5-flash", "gemini-3.6-flash"],
        )
        self.assertEqual(movie.llm_model_name, "gemini-3.6-flash")
        self.assertTrue(movie.saved)
        blocked_key = fetch.get_model_blocked_key("gemini-2.5-flash")
        self.assertEqual(redis.expiring_values[blocked_key][0], 1)
        self.assertGreater(redis.expiring_values[blocked_key][1], 0)

    def test_unavailable_model_falls_back_without_retrying_it(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        FakeClient.outcomes = {
            "gemini-2.5-flash": [api_error(404)],
            "gemini-3.6-flash": [successful_response()],
        }

        fetch.generate_dna([movie])

        self.assertEqual(
            [call["model"] for call in FakeClient.instance.models.calls],
            ["gemini-2.5-flash", "gemini-3.6-flash"],
        )

    def test_server_error_is_retried_once_on_the_same_model(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        FakeClient.outcomes = {
            "gemini-2.5-flash": [api_error(503), successful_response()],
            "gemini-3.6-flash": [],
        }

        fetch.generate_dna([movie])

        self.assertEqual(
            [call["model"] for call in FakeClient.instance.models.calls],
            ["gemini-2.5-flash", "gemini-2.5-flash"],
        )
        self.assertEqual(redis.values[fetch.get_quota_key("gemini-2.5-flash")], 2)

    def test_local_guardrail_skips_model_before_calling_api(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        redis.values[fetch.get_quota_key("gemini-2.5-flash")] = 55
        FakeClient.outcomes = {
            "gemini-2.5-flash": [],
            "gemini-3.6-flash": [successful_response()],
        }

        fetch.generate_dna([movie])

        self.assertEqual(
            [call["model"] for call in FakeClient.instance.models.calls],
            ["gemini-3.6-flash"],
        )

    def test_success_tracks_request_and_reports_exact_token_usage(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        FakeClient.outcomes = {
            "gemini-2.5-flash": [successful_response()],
            "gemini-3.6-flash": [],
        }

        output = io.StringIO()
        with patch("sys.stdout", output):
            fetch.generate_dna([movie])

        self.assertEqual(redis.values[fetch.get_quota_key("gemini-2.5-flash")], 1)
        self.assertIn(
            "input=100, output=50, thinking=25, total=175",
            output.getvalue(),
        )

    def test_minute_quota_exhaustion_does_not_block_model_for_the_day(self):
        redis = FakeRedis()
        fetch = load_fetch_module(redis)
        movie = FakeDnaMovie()
        FakeClient.outcomes = {
            "gemini-2.5-flash": [api_error(429)],
            "gemini-3.6-flash": [successful_response()],
        }

        fetch.generate_dna([movie])

        self.assertIsNone(redis.get(fetch.get_model_blocked_key("gemini-2.5-flash")))


if __name__ == "__main__":
    unittest.main()
