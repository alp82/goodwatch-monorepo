"""Stable cohorts carried in committed XML comments, shared by manual and scheduled runs."""
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from sitemap_query import CORE_LIMIT, TITLE_LIMIT

POLICY = 1
STATE_PREFIX = 'goodwatch-selection '
NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


def previous_ids(content, kind):
    if content is None:
        return []
    root = ET.fromstring(content)
    ids = []
    for loc in root.findall('s:url/s:loc', NS):
        match = re.fullmatch(rf'https://goodwatch.app/{kind}/(\d+)(?:-[^/?#]*)?', loc.text or '')
        if not match:
            raise ValueError(f'Unexpected previous {kind} URL')
        ids.append(int(match[1]))
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate previous IDs')
    return ids


def previous_state(content, kind):
    if content is None:
        return None
    matches = re.findall(rb'<!--goodwatch-selection (.*?)-->', content)
    if not matches:
        return None  # Explicitly approved first adoption of the new policy.
    if len(matches) != 1:
        raise ValueError('Duplicate selection state')
    state = json.loads(matches[0])
    if state.get('policy') != POLICY:
        raise ValueError('Unsupported selection policy; explicit migration required')
    ids = state['core'] + state['attention']
    if ids != previous_ids(content, kind) or len(ids) != TITLE_LIMIT[kind]:
        raise ValueError('Selection state does not match sitemap membership')
    if len(state['core']) != CORE_LIMIT[kind]:
        raise ValueError('Invalid core size')
    datetime.strptime(state['attention_month'], '%Y-%m')
    return state


def select_titles(rows, kind, previous=None, today=None):
    """Retain core; fill mandatory vacancies; rotate attention once per UTC month.

    No discretionary core changes. Monthly attention swaps consume at most 5%
    of the whole media cohort. Required ineligibility replacements are exempt.
    """
    month = (today or datetime.now(timezone.utc).date()).strftime('%Y-%m')
    by_id = {r[0]: r for r in rows}
    ranked = sorted(rows, key=lambda r: (-r[5], r[0]))
    core_limit, total = CORE_LIMIT[kind], TITLE_LIMIT[kind]
    if len(by_id) < total:
        raise ValueError(f'Not enough eligible {kind} titles: {len(by_id)} < {total}')
    state = previous_state(previous, kind)
    core = [i for i in state['core'] if i in by_id] if state else []
    # Keep valid attention occupants in attention while filling core vacancies.
    retained_attention = [i for i in state['attention'] if i in by_id] if state else []
    reserved = set(core + retained_attention)
    for row in ranked:
        if len(core) >= core_limit:
            break
        if row[0] not in reserved:
            core.append(row[0])
            reserved.add(row[0])
    # Small pools may require promotion of attention to fill the core.
    for i in retained_attention:
        if len(core) < core_limit:
            core.append(i)
    core_set = set(core)
    popular = [r[0] for r in sorted(rows, key=lambda r: (-(r[6] or 0), r[0])) if r[0] not in core_set]
    attention = [i for i in retained_attention if i not in core_set]
    slots = total - core_limit
    for i in popular:
        if len(attention) >= slots:
            break
        if i not in attention:
            attention.append(i)
    if state and state['attention_month'] > month:
        raise ValueError('Previous selection month is in the future')
    if state and state['attention_month'] != month:
        desired = popular[:slots]
        incoming = [i for i in desired if i not in attention]
        outgoing = [i for i in reversed(attention) if i not in desired]
        for old, new in list(zip(outgoing, incoming))[:total // 20]:
            attention[attention.index(old)] = new
    state = dict(policy=POLICY, core=core, attention=attention, attention_month=month)
    return [by_id[i] for i in core + attention], state


def state_comment(state):
    return '<!--' + STATE_PREFIX + json.dumps(state, separators=(',', ':')) + '-->\n'
