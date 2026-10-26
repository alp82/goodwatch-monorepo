# extra_requirements:
# crate==2.2.1
# mongoengine==0.29.3
# pymongo==4.18.1
# requests==2.34.2
# wmill==1.815.0
# pydantic==2.13.5
# qdrant-client==1.19.1
"""Reread checkpoints, then baseline missing lists without blocking their siblings."""
from contextlib import contextmanager
from dataclasses import dataclass
from itertools import product
import json
import math
import time

from f.tmdb_api import daily_provider_lists as job

# The six balanced groups proposed from the October 17 census, flattened in order.
COUNTRY_ORDER = tuple((
    'AR BS CD CO CV GH ID IQ LC MA MC MK MZ NG PY RU SA SC SK SN SV TC US '
    'AO BM CR FI GB IE IL JO KW LT MG MT MU PE SE SG SI TR TW TZ UY ZA '
    'AE AG BO BZ CY DE DO EC EG GI GR IN JP ME NO PF PG PH RO RS UA YE ZW '
    'AD AT BA BH BR BY CA CH CU CZ EE FJ GY JM KE KR MD NI PK PL PS QA SM '
    'AL BE BG CI CM DK DZ ES FR HR IS IT LU LV MW OM PA PT TD TH VA VE ZM '
    'AU AZ BB BF CL GF GP GQ GT HK HN HU LB LI LY ML MX MY NE NL NZ TN TT UG XK '
).split())


@dataclass
class PreparedList:
    country: str
    media_type: str
    service_id: int
    at: int
    ids: list
    candidates: list
    diagnostics: dict

    @property
    def key(self):
        return f'{self.country}:{self.media_type}:{self.service_id}'


def country_order(countries):
    wanted = set(countries)
    return [country for country in COUNTRY_ORDER if country in wanted] + sorted(wanted - set(COUNTRY_ORDER))


@contextmanager
def list_context(country, media_type, service_id):
    try:
        yield
    except Exception as error:
        error.list_scope = (country, media_type, service_id)
        raise


def record_baseline_failure(client, store, report, country, media_type, service_id, error, clock):
    failure = job.list_failure(country, media_type, service_id, error)
    failure['consecutive_failure_days'] = store.record_failure(failure['key'], job.utc_ms(clock()), failure)
    report['lists_failed'] += 1
    report['lists'].append(failure)
    print(json.dumps(failure), flush=True)
    client.consecutive_list_failures = (getattr(client, 'consecutive_list_failures', 0) + 1
                                        if isinstance(error, job.TMDBReadError) else 0)
    if client.consecutive_list_failures >= 20:
        raise job.TMDBReadError('Stopping after 20 consecutive TMDB list failures') from error


def prepare_country(client, store, country, missing, clock, report):
    prepared = []
    for media_type, service_id in missing:
        try:
            with list_context(country, media_type, service_id):
                diagnostics = {}
                at = job.utc_ms(clock())
                ids = job.read_list(client, country, media_type, service_id, diagnostics)
                key = f'{country}:{media_type}:{service_id}'
                candidates = sorted(set(ids) | store.open_ids(country, media_type, service_id) | store.pending(key))
                prepared.append(PreparedList(country, media_type, service_id, at, ids, candidates, diagnostics))
                client.consecutive_list_failures = 0
        except job.RequestBudgetExceeded as error:
            if not isinstance(error, job.BaselineBudgetExceeded):
                report['hard_budget_exceeded'] = True
            return prepared, True
        except (job.TMDBAccessDenied, job.LeaseLost):
            raise
        except Exception as error:
            record_baseline_failure(client, store, report, country, media_type, service_id, error, clock)
    return prepared, False


def confirm_country(title_reads, prepared, clock, client, store, report):
    # Finish every source check for a list before its first history write.
    confirmed = []
    for item in prepared:
        try:
            with list_context(item.country, item.media_type, item.service_id):
                job.confirm_list(title_reads, item.country, item.media_type, item.service_id,
                                 set(item.ids), item.at, item.candidates, clock)
                confirmed.append(item)
                client.consecutive_list_failures = 0
        except job.RequestBudgetExceeded as error:
            if not isinstance(error, job.BaselineBudgetExceeded):
                report['hard_budget_exceeded'] = True
            return confirmed, True
        except (job.TMDBAccessDenied, job.LeaseLost):
            raise
        except Exception as error:
            record_baseline_failure(client, store, report, item.country, item.media_type, item.service_id, error, clock)
    return confirmed, False


def publish_country(store, title_reads, prepared, clock, client, report, summaries):
    for item in prepared:
        try:
            with store.lease(item.key) as owned:
                with store.checkpoint_batch():
                    with list_context(item.country, item.media_type, item.service_id):
                        if job.utc_day(job.utc_ms(clock())) != job.utc_day(item.at):
                            raise job.IncompleteList('List read crossed UTC midnight')
                        store.stage(item.key, item.candidates)
                        members, retry_ids = job.publish_list_changes(store, title_reads, item.country, item.media_type,
                            item.service_id, set(item.ids), None, item.at, item.candidates, owned)
                        if job.utc_day(job.utc_ms(clock())) != job.utc_day(item.at):
                            raise job.IncompleteList('List read crossed UTC midnight')
                        store.flush()
                        owned()
                        if not store.dry_run:
                            store.save(item.key, dict(checked_at=item.at, ids=item.ids,
                                members={key: kinds for key, kinds in members.items() if kinds}, retry_ids=retry_ids,
                                version=1, complete=item.diagnostics['count_shortfall'] == 0, cache_bypassed=True))
                # The checkpoint committed, even if releasing its lease fails.
                summaries.append(dict(key=item.key, titles=len(item.ids), changes_checked=len(item.candidates),
                                      baseline=True, retry_titles=len(retry_ids), **item.diagnostics))
            client.consecutive_list_failures = 0
        except (job.RequestBudgetExceeded, job.TMDBAccessDenied, job.LeaseLost):
            raise
        except Exception as error:
            record_baseline_failure(client, store, report, item.country, item.media_type, item.service_id, error, clock)
    return summaries


def run_ramp(client, store, *, countries, service_ids, baseline_max_requests=120000,
             baseline_max_memberships=570000):
    clock = lambda: job.datetime.now(job.timezone.utc)
    inventory = store.inventory()
    scopes = []
    for key in sorted(inventory, key=lambda key: (inventory[key].get('checked_at', 0), key)):
        country, media, service = key.split(':')
        scopes.append((country, media, int(service)))
    required = list(product(('movie', 'show'), service_ids))
    countries = country_order(set(countries) | {scope[0] for scope in scopes})
    started, used = [], 0
    reread_start = client.stats['requests']
    estimated_rereads = sum(max(1, math.ceil(len(value.get('ids', [])) / 20))
                            + len(value.get('retry_ids', [])) for value in inventory.values())
    report = dict(lists_completed=0, lists_failed=0, lists_skipped=0, dry_run=store.dry_run, lists=[],
                  hard_budget_exceeded=False,
                  rereads_estimated_requests=estimated_rereads, rereads_complete=True,
                  rereads_budget_exceeded=estimated_rereads > client.max_requests - reread_start)
    with job.TitleChecks(client, clock, getattr(store, "db", None), store.dry_run) as title_reads:
        try:
            job.run_daily_lists(client, store, countries=[], service_ids=[], scopes=scopes,
                                title_reads=title_reads, report=report)
        except job.RequestBudgetExceeded:
            report.update(rereads_complete=False, rereads_budget_exceeded=True, hard_budget_exceeded=True)
        report.update(countries_started=started, requests_rereads=client.stats['requests'] - reread_start,
                      requests_new_baselines=0, baseline_deferred_reason=None,
                      baseline_deferred_country=None, baseline_deferred_budget=None)
        baseline_start = client.stats['requests']
        client.baseline_limit = baseline_start + baseline_max_requests
        try:
            for country in countries:
                if report['rereads_budget_exceeded']:
                    report['baseline_deferred_reason'] = 'rereads_exceed_hard_budget'
                    break
                missing = [(media, service) for media, service in required if f'{country}:{media}:{service}' not in inventory]
                if not missing:
                    continue
                if used >= baseline_max_memberships or baseline_max_requests == 0:
                    budget = 'memberships' if used >= baseline_max_memberships else 'requests'
                    report.update(baseline_deferred_reason=budget, baseline_deferred_country=country,
                                  baseline_deferred_budget=budget)
                    break
                summaries = []
                try:
                    prepared, discovery_budget_stop = prepare_country(client, store, country, missing, clock, report)
                    memberships = sum(len(item.candidates) for item in prepared)
                    if used + memberships > baseline_max_memberships:
                        report.update(baseline_deferred_country=country, baseline_deferred_budget='memberships',
                                      baseline_deferred_reason='memberships' if started else 'country_exceeds_budget')
                        break
                    prepared, confirmation_budget_stop = confirm_country(title_reads, prepared, clock, client, store, report)
                    publish_country(store, title_reads, prepared, clock, client, report, summaries)
                except job.RequestBudgetExceeded as error:
                    if not isinstance(error, job.BaselineBudgetExceeded):
                        report['hard_budget_exceeded'] = True
                    report.update(baseline_deferred_country=country, baseline_deferred_budget='requests',
                                  baseline_deferred_reason='requests' if started or summaries else 'country_exceeds_budget')
                    break
                except (job.TMDBAccessDenied, job.LeaseLost) as error:
                    error.report = report
                    raise
                finally:
                    report['lists_completed'] += len(summaries)
                    report['lists'].extend(summaries)
                    for summary in summaries:
                        inventory[summary['key']] = {}
                    committed_memberships = sum(summary['changes_checked'] for summary in summaries)
                    used += committed_memberships
                    if summaries:
                        started.append(country)
                        print(json.dumps(dict(country_started=country, memberships=committed_memberships)), flush=True)
                if discovery_budget_stop or confirmation_budget_stop:
                    report.update(baseline_deferred_country=country, baseline_deferred_budget='requests',
                                  baseline_deferred_reason='requests' if started else 'country_exceeds_budget')
                    break
        finally:
            client.baseline_limit = None
            report['requests_new_baselines'] = client.stats['requests'] - baseline_start
            report['countries_remaining'] = [country for country in countries if any(
                f'{country}:{media}:{service}' not in inventory for media, service in required)]
            report['countries_partial'] = {
                country: [f'{country}:{media}:{service}' for media, service in required
                          if f'{country}:{media}:{service}' not in inventory]
                for country in report['countries_remaining']
                if any(f'{country}:{media}:{service}' in inventory for media, service in required)
            }
            report['baseline_memberships'] = used
            report['baseline_budget'] = dict(max_requests=baseline_max_requests, max_memberships=baseline_max_memberships)
            report['ramp_complete'] = not report['countries_remaining']
    return report


def run_daily_job(*, countries, service_ids, dry_run, requests_per_second, max_requests,
                  baseline_max_requests, baseline_max_memberships):
    # Windmill loads the entry script separately from its f.* import. Construct
    # clients here from the same module whose exception classes run_ramp catches.
    for name, value in (('baseline_max_requests', baseline_max_requests),
                        ('baseline_max_memberships', baseline_max_memberships)):
        if type(value) is not int or value < 0:
            raise ValueError(f'{name} must be a nonnegative integer')
    dry_run = dry_run is not False
    started = time.monotonic()
    client = job.TMDBClient(requests_per_second, max_requests)
    store = job.create_list_storage(dry_run=dry_run)
    try:
        with store.run_lease() as owned:
            owned()
            if countries is None:
                regions = client.get('/watch/providers/regions')['results']
                countries = sorted({region['iso_3166_1'] for region in regions} | set(store.countries()))
            services = list(job.SERVICE_NAMES) if service_ids is None else service_ids
            if any(type(service_id) is not int or service_id <= 0 for service_id in services):
                raise ValueError('Service IDs must be positive integers')
            if any(len(country) != 2 or not country.isascii() or not country.isupper() or not country.isalpha() for country in countries):
                raise ValueError('Countries must be uppercase two-letter codes')
            report = run_ramp(client, store, countries=sorted(set(countries)), service_ids=sorted(set(services)),
                              baseline_max_requests=baseline_max_requests,
                              baseline_max_memberships=baseline_max_memberships)
            # Same pacing, retries and HARD budget as discovery/confirmation.
            # Pending records survive budget exhaustion and publication failures.
            if not dry_run:
                from f.tmdb_api.list_offer_refresh import drain
                try:
                    # Leave catch-up capacity above the observed 20–23k daily
                    # changes; the shared request and remaining-time caps win.
                    report['offer_refresh'] = drain(client, store.db, store.connector,
                        dry_run=False, limit=30000, check_owned=owned,
                        max_seconds=max(0, 27000 - (time.monotonic() - started)))
                except job.RequestBudgetExceeded:
                    report['hard_budget_exceeded'] = True
            report['seconds'] = round(time.monotonic() - started, 3)
            report['requests'] = getattr(client, 'stats', {})
            report['history'] = getattr(store, 'stats', {})
            report['countries'] = countries
            return report
    except (job.TMDBAccessDenied, job.LeaseLost) as error:
        if hasattr(error, 'report'):
            error.report.update(seconds=round(time.monotonic() - started, 3), requests=client.stats,
                                history=getattr(store, 'stats', {}), countries=countries)
            print(json.dumps(dict(event='daily_list_run_stopped', error=type(error).__name__,
                                  report=error.report)), flush=True)
        raise
    except job.LeaseBusy:
        return dict(lists_completed=0, lists_failed=0, lists_skipped=0, lists=[],
                    dry_run=dry_run, run_skipped=True)
    finally:
        store.close()

def main():
    pass
