# Change Log

Notable changes to GoodWatch will be documented in this file.

## [0.7.0] 2025-06-xx

Minor Release: **New Database and DNA Overhaul**

### Added
* completely new DNA pipeline

### Changed

### Fixed

## [0.6.6] 2025-05-13

### Added

### Changed
* Completely redesigned Details page: Better accessibility and usability

### Fixed

## [0.6.5] 2025-04-11

### Added
* Show more than 100 results by using infinite scroll. Works both for the Explore and Discover screens
* Added resource monitoring for all servers via Grafana

### Changed
* Redis Cache is optional and won't throw an error if unavailable

### Fixed

## [0.6.4] 2025-03-26

### Added

### Changed
* Redis cache connections are now optional. If the cluster is down, the website still works

### Fixed
* Updated DNA explore queries to work with new ID's that needed to be recreated due to data corruption when Postgres cluster failed syncing 

## [0.6.3] 2025-03-01

### Added

### Changed

### Fixed
* Hydration Errors
* Sitemaps
* Database scaling failure

## [0.6.2] 2025-02-09

### Added
* More and better meta tags for SEO
* Added more moods to explore pages
* Additional filters in Explore pages for own streaming services and titles the user didn't watch

### Changed

### Fixed
* Removed hardcoded development environment to speed up the page and hide internal devtools

## [0.6.1] 2025-02-01

### Added
* New main navigation for Movies and TV Shows
* Explore titles by detailed categories powered by DNA
* Proper Meta tags and JSON-LD data for SEO

### Changed

### Fixed

## [0.6.0] 2025-01-11

Minor Release: **Improved DNA**

### Added
* Cluster detection for DNA tags

### Changed
* DNA autocomplete only shows primary tags of each cluster
* Much better model for similarity calculation of DNA tags
* Faster Discovery page load

### Fixed
* Similarity issues, e.g. "Dark Palette" was too close to "Vibrant Palette" although they are visually very different

## [0.5.8] 2024-12-08

### Added

### Changed
* Faster start page load with webp background images

### Fixed

## [0.5.7] 2024-11-30

### Added
* Sign In via Email
* User Settings Page to change country, streaming and password

### Changed

### Fixed
* Details: Some streaming links were not shown (e.g. parts of Amazon Prime and Apple TV Plus)

## [0.5.6] 2024-11-21

### Added
* Discover: Cast and Crew members can now be filtered to match all entries at once for each title, e.g. all movies that star both "Edward Norton" and "Brad Pitt"

### Changed

### Fixed
* Major cleanup of duplicate DNA values
* Corrected wrong capitalization for DNA values with apostrophes, e.g. "Children'S Adventure"

## [0.5.5] 2024-11-17

### Added
* Discover: Streaming filter is not only showing flatrate, but also buy/rent titles if chosen

### Changed

### Fixed
* Discover results were never complete because a streaming filter was always implicitly added 
* Discover DNA filter allowed SQL injection

## [0.5.4] 2024-11-14

### Added

### Changed
* Details: Some DNA tags are inlined in more intuitive places

### Fixed
* Some streaming services were duplicates and didn't show any results

## [0.5.3] 2024-11-13

### Added

### Changed

### Fixed
* Onboarding could not be completed (only registered after 60 minutes due to aggresive caching)
* Discover: On mobile, the filter bar dropdowns are not hidden by the results below
* Details: Clicking on the country flag in the details screen caused a blank screen with a cryptic error message
* Details: Show DNA discover preview results

## [0.5.2] 2024-11-11

### Added

### Changed

### Fixed
* On mobile, the score selector cancels scoring on vertical movement

## [0.5.1] 2024-11-10

### Added
* Presets for Discover

### Changed
* Updated Frontend Dependencies
* Improved Similarity Query

### Fixed
* Genre filter does not show duplicates anymore

## [0.5.0] 2024-11-09

Minor Release: **Improved Discovery**

### Added
* New filters for Discover page, now including:
    - Watch
    - Streaming Services
    - Score / Ratings
    - Similar
    - DNA
    - Genres
    - Release Date
    - Cast & Crew

### Changed
* Better UX for Discover page
* Long select lists are virtualized for better performance

### Fixed

## [0.4.3] 2024-10-16

### Added

### Changed
* Better watch button colors and texts

### Fixed

## [0.4.2] 2024-10-12

### Added
* Global loading indicator

### Changed
* Much faster page load: links are not causing a full page reload anymore
* Removed unnecessary page transition animation
* Much smoother carousel on home page 

### Fixed

## [0.4.1] 2024-10-12

### Added

### Changed
* Better search bar UX

### Fixed
* Blank Screen after Login
* Discover Genre Filter did show duplicate entries
* Less content jumping as DNA similarities are loaded

## [0.4.0] 2024-10-05

Minor Release: **Similarity Engine**

### Added
* New How it works page
* DNA section for movies and shows with preview of similar titles

### Changed
* DNA: Show similar titles based on DNA categories based on new similarity algorithm
* Completely revamped Landing Page design
* Updated Details Page design
* Rewrote DB queries for fetching movies and shows with filters to make them more performant and reusable across different views

### Fixed

## [0.3.3] 2024-09-25

### Added

### Changed
* Improved Onboarding UX for rating titles and better search display
* Removed some streaming providers to show duplicated in the UI

### Fixed
* Discover filter for streaming services was resetting immediately for signed in users

## [0.3.2] 2024-09-23

### Added
* New DNA generation and storage: Self-hosted service that uses `jinaai/jina-embeddings-v2-small-en` and stores all vectors in PostgreSQL instead of Weaviate
* Vectors can now be queried together with all existing filters (not used in the UI yet)

### Changed

### Fixed

## [0.3.1] 2024-09-21

### Added
* Completely revamped prompt and processing for Genome DNA generation
* Filter invalid DNA categories and values
* All DNA categories:
```
  Sub-Genres
  Mood
  Themes
  Plot
  Cultural Impact
  Character Types
  Dialog
  Narrative
  Humor
  Pacing
  Time
  Place
  Cinematic Style
  Score and Sound
  Costume and Set
  Key Props
  Target Audience
  Flag
```

### Changed

### Fixed

## [0.3.0] 2024-09-20

Minor Release: **Streaming with Daily Accuracy**

### Added
* It is now saved when streaming links were first recorded. This can be used later in order to show new titles available for each streaming service.

### Changed
* Streaming Availability is now shown with daily accuracy. Previously, it could be very outdated, up to weeks or even months.
* Removed duplicate streaming providers from showing up in the UI (e.g. Netflix and Netflix with Ads)

### Fixed
* Previously, the task that updated the streaming availability was blocking the database for around 20 minutes every night at 3am (UTC). This is now fixed.

## [0.2.28] 2024-09-15

### Added

### Changed
* Secure queries to avoid SQL injection
* Nicer Cookie Consent Dialog with chosen action stored in user settings

### Fixed
* Do not show onboarding when it was already completed
* Discover filter by cast was throwing an error
* Do not cut off long descriptions on smaller screens

## [0.2.27] 2024-09-14

### Added

### Changed
* Onboarding: Better UX
* Remove Header transparency

### Fixed

## [0.2.26] 2024-09-12

### Added
* Onboarding: Users that are signed in are asked to select their country and streaming services. They can also rate their favorite titles.
* Daily database backups

### Changed

### Fixed

## [0.2.25] 2024-09-01

### Added
* Self-hosted reverse proxy via Caddy for Posthog, Uptime Kuma and Windmill

### Changed

### Fixed

## [0.2.24] 2024-08-06

### Added

### Changed
* Faster query to fetch countries

### Fixed
* Servers running out of processes pool due to zombies

## [0.2.23] 2024-07-28

### Added
* Show wooter on mobile

### Changed
* Explore page grid display improvements with large and small posters

### Fixed
* Explore query issues
* Cached explore queries

## [0.2.22] 2024-07-22

### Added
* Explore page for DNA tags
* Zellij config

### Changed
* Windmill and Weaviate updates

### Fixed
* Undefined search results
* Empty DNA handling

## [0.2.21] 2024-06-27

### Added
* DNA section for movies and TV shows

### Changed

### Fixed

## [0.2.20] 2024-06-21

### Added
* Biome for linting and formatting

### Changed

### Fixed

## [0.2.19] 2024-06-19

### Added
* Sentry for error tracking

### Changed

### Fixed

## [0.2.18] 2024-06-18

### Added
* Posthog for analytics
* Cookie Consent dialog and privacy policy

### Changed

### Fixed

## [0.2.17] 2024-06-13

### Added

### Changed
* Design improvements
* Details page: scroll tabs into view

### Fixed
* Scroll on mobile does not trigger hover effect
* Duplicated videos and remove autoplay

## [0.2.16] 2024-05-29

### Added

### Changed

### Fixed
* Mobile main menu
* Score selector on mobile
* Back button on Discover page
* Duplicated rows for user data
* Flickering header login

## [0.2.15] 2024-05-25

### Added
* Users can rate movies and tv shows from 1 to 10

### Changed
* Improved mobile design for user actions and movie posters

### Fixed

## [0.2.14] 2024-05-19

### Added
* Dialog to ask for sign in if user action is clicked

### Changed
* Improved score display

### Fixed

## [0.2.13] 2024-05-15

### Added
* Users can select titles to watch
* Users can set their favorite titles
* Users can add titles to their already watched list

### Changed

### Fixed

## [0.2.12] 2024-05-13

### Added
* Supabase Authentication via Google

### Changed

### Fixed

## [0.2.11] 2024-05-12

### Added
* Priority queue for most popular titles to be updated

### Changed

### Fixed

## [0.2.10] 2024-05-11

### Added
* New link to publicly available status page

### Changed

### Fixed
* Windmill flow and script fixes

## [0.2.9] 2024-05-08

### Added
* Country selection persisted in browser's local storage

### Changed
* More discover results

### Fixed
* Discover initial loading shows correctly
* Wrong query if no streaming providers are selected

## [0.2.8] 2024-05-06

### Added
* Monitoring via Uptime Kuma

### Changed

### Fixed

## [0.2.7] 2024-05-05

### Added
* New About page
* New Disclaimer page

### Changed

### Fixed

## [0.2.6] 2024-03-26

### Added

### Changed
* Show available streaming countries on details page
* Details improvements: tabs and country selector
* More organized main header

### Fixed

## [0.2.5] 2024-03-05

### Added

### Changed
* Upgrade Remix from v1 to v2

### Fixed

## [0.2.4] 2024-02-11

### Added

### Changed

### Fixed
* Discover fix for filtering by cast and crew

## [0.2.3] 2024-02-06

### Added
* How it works section on landing page
* Cleaner details page
* Smaller footprint for details and trending endpoints

### Changed

### Fixed
* Windmill flow and script fixes

## [0.2.2] 2024-02-05

### Added
* Mongo Cluster instead of single node
* Proper healthcheck in docker compose

### Changed

### Fixed
* Windmill flow and script fixes

## [0.2.1] 2024-02-01

### Added

### Changed
* Smaller footprint for discover endpoints
* Error page with refresh button

### Fixed

## [0.2.0] 2024-01-31

Minor Release: **Windmill Data Pipeline**

### Added

### Changed
* Lots of improvements for Windmill infrastructure, integrations and flows

### Fixed
* Caching for DB queries

## [0.1.12] 2023-12-04

### Added

### Changed
* Improved Landing Page UI
* Better Discover filters

### Fixed

## [0.1.11] 2023-12-02

### Added
* Redis as DB cache for webapp

### Changed
* Scheduled updates for data fetching

### Fixed

## [0.1.10] 2023-11-23

### Added

### Changed
* Renamed project from Flickvibe to **GoodWatch**

### Fixed

## [0.1.9] 2023-11-23

### Added
* New Postgres DB to separate data pipeline from webapp operations

### Changed
* New improved design for details page

### Fixed
* Rating overlay for small screens

## [0.1.8] 2023-11-03

### Added

### Changed
* Many data pipeline improvements
* More workers and increased RAM 

### Fixed
* Issues with windmill worker environment
* Increased max db connections

## [0.1.7] 2023-10-07

### Added
* New data pipeline experiment with Windmill instead of Prefect
* Data persistence is split in two: raw and combined data

### Changed

### Fixed

## [0.1.6] 2023-09-25

### Added
* New data pipeline experiments via Prefect

### Changed

### Fixed

## [0.1.5] 2023-05-25

### Added

### Changed
* Performance improvements: new db indexes

### Fixed
* Issues with parallel data fetching tasks

## [0.1.4] 2023-05-21

### Added
* New data fetching for TVTropes

### Changed
* Data fetching stores additional data:
    * relations
    * seasons
    * translations
    * keywords
    * images and videos
    * networks
    * production companies

### Fixed

## [0.1.3] 2023-05-20

### Added

### Changed
* Style improvements for trending page (thanks @stickyburn)
* Better error handling for rate limiting

### Fixed

## [0.1.2] 2023-05-01

### Added
* Data fetching for crew and cast
* Data fetching for streaming providers
* Data fetching for IMDb, Metacritic and Rotten Tomatoes

### Changed
* Bulk upserts with better performance

### Fixed
* Failing Upsert queries

## [0.1.1] 2023-04-17

### Added
* Data fetching for TMDB daily data

### Changed
* Data fetching is now done in parallel

### Fixed
* Wrong usage of country codes for details fetching

## [0.1.0] 2023-03-31

Minor Release: **Dedicated Data Fetching App**

### Added
* Performance: Instead of fetching all data on the fly, a new data fetching app stores all data in Supabase

### Changed

### Fixed

## [0.0.5] 2023-03-24

### Added
* Footer with credits and link to Github

### Changed
* Better layout on big screens
* Improved colors for ratings and third party logos

### Fixed

## [0.0.4] 2023-03-22

### Added
* Discover: filter by streaming providers
* Details: show videos (e.g. Trailers)
* Details: show age rating, tagline, prequels and sequels

### Changed
* Parallel data fetching for faster page loading
* New logo

### Fixed

## [0.0.3] 2023-03-13

### Added
* Discover page to filter titles by genre
* Details with description

### Changed

### Fixed

## [0.0.2] 2023-03-11

### Added
* Trending movies and TV shows
* Ratings link to the respective sites
* Aggregated scores are cached on Supabase

### Changed
* Better UX on Mobile

### Fixed

## [0.0.1] 2023-03-06

**Initial Release**

### Added
* Show aggregated scores from IMDb, MetaCritic, and Rotten Tomatoes.
* Show streaming services that have the title available

### Changed

### Fixed
