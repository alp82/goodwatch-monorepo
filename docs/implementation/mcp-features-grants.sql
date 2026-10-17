-- Q53: share-list create/edit tools run as goodwatch_search on search roles.
-- Keep the existing seven table DML grants, schema DQL and auth-table DENYs unchanged.
-- Profiles and handles are read only: members choose their handle on the site.
GRANT DML ON TABLE doc.user_list TO goodwatch_search;
