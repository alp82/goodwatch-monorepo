import requests
import wmill

from f.sync.models.crate_models import Job
from f.sync.models.tmdb_models import TMDBJobItem, TMDBJobsResponse
from f.db.cratedb import CrateConnector


TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_jobs() -> TMDBJobsResponse:
    url = (
        "https://api.themoviedb.org/3/configuration/jobs"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBJobsResponse(response)


def process_jobs(job_items: list[TMDBJobItem]):
    print(f"Processing jobs...")

    job_docs: list[Job] = []
    added_keys: list[str] = []
    for job_item in job_items:
        for job in job_item.jobs:
            if job not in added_keys:
                added_keys.append(job)
                document = Job(
                    job_title=job,
                    department_name=job_item.department,
                )
                job_docs.append(document)
    
    print(f"Prepared {len(job_docs)} jobs.")
    return job_docs



def main():
    print("Fetching jobs...")
    job_items = fetch_jobs()
    
    jobs  = process_jobs(job_items.root)

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="job",
        records=jobs,
        conflict_columns=["job_title", "department_name"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }
