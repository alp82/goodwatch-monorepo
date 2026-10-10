-- Project 24375; snapshot queried 2026-10-10.
-- Date bounds are Europe/Berlin; end is exclusive.
-- Render the private filter placeholder with the accompanying Python script.
-- Never commit the rendered queries: configured filter values are private.

-- QUERY: googlemonthly
SELECT toStartOfMonth(toTimeZone(started, 'Europe/Berlin')) AS month, country, device, count() AS sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities, countIf(landing = '/') AS home_sessions, countIf(pageviews > 1) AS multi_page_sessions FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer = 'www.google.com' GROUP BY month, country, device ORDER BY month, sessions DESC LIMIT 500;

-- QUERY: weekly
SELECT toStartOfWeek(toTimeZone(started, 'Europe/Berlin'), 1) AS week, count() AS sessions, sum(pageviews) AS pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer IN ('www.google.com', 'www.bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com', 'us.search.yahoo.com', 'r.search.yahoo.com', 'www.ecosia.org', 'coccoc.com', 'yandex.com', 'yandex.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.uz', 'yandex.by', 'ya.ru') GROUP BY week ORDER BY week LIMIT 100;


-- QUERY: engineLandings
SELECT referrer, multiIf(landing = '/', '/', match(landing, '^/movie/[^/]+/?$'), '/movie/{id}-{slug}', match(landing, '^/show/[^/]+/?$'), '/show/{id}-{slug}', match(landing, '^/(movies|shows)/moods/'), '/{movies|shows}/moods/{slug}', match(landing, '^/(movies|shows)/'), '/{movies|shows}/{category}/{slug}', landing IN ('/movies','/shows','/discover','/explorer','/search'), landing, match(landing, '^/u/'), '[private profile/share route]', '[other route]') AS landing_shape, count() AS sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer IN ('www.google.com', 'www.bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com', 'us.search.yahoo.com', 'r.search.yahoo.com', 'www.ecosia.org', 'coccoc.com', 'yandex.com', 'yandex.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.uz', 'yandex.by', 'ya.ru') OR referrer IN ('chatgpt.com','gemini.google.com','l.meta.ai') GROUP BY referrer, landing_shape ORDER BY referrer, sessions DESC LIMIT 100;

-- QUERY: totals
SELECT count() AS sessions, uniq(sid) AS distinct_sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities, sum(custom_pageviews) AS total_custom_pageviews, countIf(custom_pageviews > 0) AS sessions_with_custom_pageview FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer IN ('www.google.com', 'www.bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com', 'us.search.yahoo.com', 'r.search.yahoo.com', 'www.ecosia.org', 'coccoc.com', 'yandex.com', 'yandex.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.uz', 'yandex.by', 'ya.ru');

-- QUERY: usmobile
SELECT count() AS sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities, countIf(landing = '/') AS home_sessions, countIf(pageviews > 1) AS multi_page_sessions FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer = 'www.google.com' AND country = 'US' AND device = 'Mobile' AND started >= toDateTime('2026-04-01 00:00:00','Europe/Berlin') AND started < toDateTime('2026-08-01 00:00:00','Europe/Berlin');

-- QUERY: validation
SELECT count() AS sessions_with_pageview, countIf(persons_in_session > 1) AS multiple_person_ids, countIf(custom_pageviews > 0) AS sessions_with_custom, sum(custom_pageviews) AS total_custom_pageviews, max(last_captured) AS last_captured FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    uniq(person_id) AS persons_in_session,
    max(timestamp) AS last_captured,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app');

-- QUERY: googleweekly
SELECT toStartOfWeek(toTimeZone(started,'Europe/Berlin'), 1) AS week, count() AS sessions, sum(pageviews) AS total_pageviews, countIf(interactions > 0) AS interacting_sessions FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer = 'www.google.com' GROUP BY week ORDER BY week LIMIT 100;

-- QUERY: monthly
SELECT toStartOfMonth(toTimeZone(started, 'Europe/Berlin')) AS month, count() AS sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer IN ('www.google.com', 'www.bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com', 'us.search.yahoo.com', 'r.search.yahoo.com', 'www.ecosia.org', 'coccoc.com', 'yandex.com', 'yandex.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.uz', 'yandex.by', 'ya.ru') GROUP BY month ORDER BY month LIMIT 20;

-- QUERY: coverage
SELECT event, toStartOfMonth(toTimeZone(timestamp, 'Europe/Berlin')) AS month, count() AS events, countIf(NOT $virt_is_bot) AS nonbot, countIf($session_id IS NOT NULL AND $session_id != '') AS with_session FROM events WHERE timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin') AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin') AND event IN ('$pageview','Pageview','$autocapture') AND {{test_account_keep_predicate}} GROUP BY event, month ORDER BY month, event LIMIT 100;

-- QUERY: referrers
SELECT referrer, channel, count() AS sessions, sum(pageviews) AS pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') GROUP BY referrer, channel ORDER BY sessions DESC LIMIT 100;

-- QUERY: primary-landings
SELECT multiIf(landing = '/', '/', match(landing, '^/movie/[^/]+/?$'), '/movie/{id}-{slug}', match(landing, '^/show/[^/]+/?$'), '/show/{id}-{slug}', match(landing, '^/(movies|shows)/moods/'), '/{movies|shows}/moods/{slug}', match(landing, '^/(movies|shows)/'), '/{movies|shows}/{category}/{slug}', landing IN ('/movies','/shows','/discover','/explorer','/search'), landing, match(landing, '^/u/'), '[private profile/share route]', '[other route]') AS landing_shape, count() AS sessions, sum(pageviews) AS total_pageviews, uniq(pid) AS identities, countIf(interactions > 0) AS interacting_sessions, uniqIf(pid, interactions > 0) AS interacting_identities FROM (SELECT
    $session_id AS sid,
    any(person_id) AS pid,
    any(session.$start_timestamp) AS started,
    any(session.$entry_referring_domain) AS referrer,
    any(session.$entry_pathname) AS landing,
    any(session.$entry_hostname) AS hostname,
    any(session.$channel_type) AS channel,
    argMinIf(properties.$geoip_country_code, timestamp, event = '$pageview') AS country,
    argMinIf(properties.$device_type, timestamp, event = '$pageview') AS device,
    countIf(event = '$pageview') AS pageviews,
    countIf(event = 'Pageview') AS custom_pageviews,
    countIf(event = '$autocapture') AS interactions
FROM events
WHERE timestamp >= toDateTime('2026-02-28 00:00:00', 'Europe/Berlin')
  AND timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp >= toDateTime('2026-03-01 00:00:00', 'Europe/Berlin')
  AND session.$start_timestamp < toDateTime('2026-10-10 00:00:00', 'Europe/Berlin')
  AND event IN ('$pageview', 'Pageview', '$autocapture')
  AND $session_id IS NOT NULL AND $session_id != ''
  AND NOT $virt_is_bot
  AND {{test_account_keep_predicate}}
GROUP BY sid
HAVING pageviews > 0 AND hostname = 'goodwatch.app') WHERE referrer IN ('www.google.com', 'www.bing.com', 'duckduckgo.com', 'search.brave.com', 'search.yahoo.com', 'us.search.yahoo.com', 'r.search.yahoo.com', 'www.ecosia.org', 'coccoc.com', 'yandex.com', 'yandex.ru', 'yandex.com.tr', 'yandex.kz', 'yandex.uz', 'yandex.by', 'ya.ru') GROUP BY landing_shape ORDER BY sessions DESC LIMIT 30;

