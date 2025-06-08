from pydantic import BaseModel, Field, RootModel
from typing import Literal, Union


TMDBMediaType = Union[Literal["movie"], Literal["tv"]]


# certification

class TMDBCertificationItem(BaseModel):
    certification: str = Field(..., description="The certification rating code (e.g., 'G', 'PG', 'MA 15+').")
    meaning: str = Field(..., description="A description of what the certification means.")
    order: int = Field(..., description="An integer representing the order or level of the certification.")


class TMDBCertificationsByCountry(RootModel[dict[str, list[TMDBCertificationItem]]]):
   pass


class TMDBCertificationsResponse(BaseModel):
    certifications: TMDBCertificationsByCountry = Field(..., description="Contains all certification information grouped by country.")
    
    
# country

class TMDBCountryItem(BaseModel):
    iso_3166_1: str = Field(..., description="The ISO 3166-1 code for the country (e.g., 'AD', 'AE').")
    english_name: str = Field(..., description="The English name of the country.")
    native_name: str = Field(..., description="The native name of the country.")


class TMDBCountriesResponse(RootModel[list[TMDBCountryItem]]):
    pass   


# genre

class TMDBGenre(BaseModel):
    id: int = Field(..., description="The TMDb ID for the genre.")
    name: str = Field(..., description="The genre name.")


class TMDBGenreResponse(BaseModel):
    genres: list[TMDBGenre] = Field(..., description="Contains a list of all genres for either movies or shows.")


# jobs

class TMDBJobItem(BaseModel):
    department: str = Field(..., description="The name of the department (e.g., 'Actors', 'Directing').")
    jobs: list[str] = Field(..., description="A list of job titles within this department.")


class TMDBJobsResponse(RootModel[list[TMDBJobItem]]):
    pass   


# language

class TMDBLanguageItem(BaseModel):
    iso_639_1: str = Field(..., description="The ISO 3166-1 code for the language (e.g., 'AD', 'AE').")
    english_name: str = Field(..., description="The English name of the language.")
    name: str = Field(..., description="The native name of the language.")


class TMDBLanguagesResponse(RootModel[list[TMDBLanguageItem]]):
    pass   


# provider

class TMDBProvider(BaseModel):
    provider_id: int
    provider_name: str
    logo_path: str
    display_priority: int
    display_priorities: dict[str, int]


class TMDBProvidersResponse(BaseModel):
    results: list[TMDBProvider]


# timezone

class TMDBTimezoneItem(BaseModel):
    iso_3166_1: str = Field(..., description="The ISO 3166-1 code for the country (e.g., 'AD', 'AE').")
    zones: list[str] = Field(..., description="A list of timezone strings for the country (e.g., ['Europe/Andorra']).")


class TMDBTimezonesResponse(RootModel[list[TMDBTimezoneItem]]):
    pass   


def main():
    pass