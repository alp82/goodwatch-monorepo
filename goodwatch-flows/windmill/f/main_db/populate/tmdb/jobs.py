import requests
import wmill

from f.db.arango import ArangoConnector
from f.main_db.config.graph import COLLECTIONS, EDGES
from f.main_db.models.arango import Edge, Department, Job
from f.main_db.models.tmdb import TMDBJobItem, TMDBJobsResponse


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

    department_docs: list[Department] = []
    job_docs: list[Job] = []
    edges: list[Edge] = []
    for job_item in job_items:
        department_key = job_item.department
        document = Department(
            _key=department_key,
            name=job_item.department,
        )
        department_docs.append(document)
        for job in job_item.jobs:
            job_key = job.replace("/", "_")
            document = Job(
                _key=job_key,
                title=job,
            )
            job_docs.append(document)
            edge = Edge(
                _from=f"{COLLECTIONS['jobs']}/{job_key}",
                _to=f"{COLLECTIONS['departments']}/{department_key}",
            )
            edges.append(edge)
    
    print(f"Prepared {len(department_docs)} departments with a total of {len(job_docs)} jobs.")
    return department_docs, job_docs, edges



def main():
    print("Fetching jobs...")
    job_items = fetch_jobs()
    
    departments, jobs, edges  = process_jobs(job_items.root)
    connector = ArangoConnector()

    departments_collection = connector.db.collection(COLLECTIONS["departments"])
    department_upsert_result = connector.upsert_many(
        collection=departments_collection,
        documents=departments,
    )

    jobs_collection = connector.db.collection(COLLECTIONS["jobs"])
    jobs_upsert_result = connector.upsert_many(
        collection=jobs_collection,
        documents=jobs,
    )

    edge_collection = connector.db.collection(EDGES["job_is_part_of_department"]["name"])
    edge_upsert_result = connector.upsert_many(
        collection=edge_collection,
        documents=edges,
    )

    connector.close()
    return {
        "departments": department_upsert_result,
        "jobs": jobs_upsert_result,
        "edges": edge_upsert_result,
    }
