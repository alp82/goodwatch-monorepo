import requests
import wmill

from f.main_db.config.graph import COLLECTIONS
from f.main_db.models.arango import MediaType, AgeCertification
from f.main_db.models.tmdb import TMDBMediaType, TMDBCertificationsByCountry, TMDBCertificationsResponse
from f.db.arango import ArangoConnector

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
                _key=f"{country_code}_{cert_item.certification}_{media_type}",
                country_code=country_code,
                media_type=media_type,
                code=cert_item.certification,
                meaning=cert_item.meaning,
                order=cert_item.order,
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

    connector = ArangoConnector()
    age_cert_collection = connector.db.collection(COLLECTIONS["age_certifications"])
    upsert_result = connector.upsert_many(
        collection=age_cert_collection,
        documents=age_certifications,
    )

    connector.close()
    return upsert_result

    
