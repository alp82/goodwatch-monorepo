import requests
import wmill

from f.sync.models.crate_models import MediaType, AgeCertification
from f.sync.models.tmdb_models import TMDBMediaType, TMDBCertificationsByCountry, TMDBCertificationsResponse
from f.db.cratedb import CrateConnector

TMDB_API_KEY = wmill.get_variable("u/Alp/TMDB_API_KEY")


def fetch_certifications(type: TMDBMediaType) -> TMDBCertificationsResponse:
    url = (
        f"https://api.themoviedb.org/3/certification/{type}/list"
        f"?api_key={TMDB_API_KEY}"
    )
    response = requests.get(url).json()
    return TMDBCertificationsResponse(**response)


def process_certifications(media_type: MediaType, certifications: TMDBCertificationsByCountry):
    print(f"Processing {media_type} certifications...")

    age_certifications: list[AgeCertification] = []
    for country_code, cert_list in certifications.root.items():
        for cert_item in cert_list:
            document = AgeCertification(
                certification_code=cert_item.certification,
                country_code=country_code,
                media_type=media_type,
                meaning=cert_item.meaning,
                order_default=cert_item.order,
            )
            age_certifications.append(document)
    
    print(f"Prepared {len(age_certifications)} {media_type} certification documents.")
    return age_certifications



def main():
    print("Fetching age certifications for movies and shows...")
    certifications_movie = fetch_certifications("movie")
    certifications_show = fetch_certifications("tv")
    
    age_certifications: list[AgeCertification] = (
        process_certifications("movie", certifications_movie.certifications) +
        process_certifications("show", certifications_show.certifications)
    )

    connector = CrateConnector()
    upsert_affected_rows = connector.upsert_many(
        table="age_certification",
        records=age_certifications,
        conflict_columns=["certification_code", "country_code", "media_type"],
    )
    connector.disconnect()

    return {
        "affected_rows": upsert_affected_rows,
    }    
