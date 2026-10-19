/* One pinned desktop CarouselPage adapter. No query text, tokens or discovery.
 * Build/document constants are installed locally by scripts/package.mjs, never
 * copied from the owner's private capture into Git. */
(() => {
  if (globalThis.GWS5Adapter) return;
  const config = globalThis.GWS5AdapterConfig;
  const fault = code => { throw Object.assign(new Error(code), { s5Code: code }); };
  const text = v => typeof v === 'string' && v.length > 0 && v.length <= 1000 && !/[\x00-\x1f\x7f]/.test(v);
  const id = v => (typeof v === 'number' || (typeof v === 'string' && /^[1-9]\d*$/.test(v))) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? String(v) : null;
  const position = v => {
    if (typeof v !== 'string' || v.length > 64) return null;
    try { const s = atob(v); return /^(0|[1-9]\d{0,3})$/.test(s) && Number(s) < 5000 ? Number(s) : null; } catch { return null; }
  };
  function settings() {
    if (!config || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(config.documentId || '')) fault('build_unsupported');
    if (location.origin !== 'https://www.netflix.com' || !/^\/browse\/my-list\/?$/.test(location.pathname) || location.search || location.hash || window !== top) fault('page_unsupported');
    const m = globalThis.netflix?.reactContext?.models;
    if (m?.serverDefs?.data?.BUILD_IDENTIFIER !== config.build) fault('build_unsupported');
    const scripts = [...document.scripts].filter(s => s.hasAttribute('src') && new URL(s.getAttribute('src'), location.href).pathname.endsWith('/' + config.script.replace(/^\//, '')));
    if (scripts.length !== 1) fault('build_unsupported');
    if (m?.browserInfo?.data?.isMobile !== false) fault('platform_unsupported');
    const f = m?.fastProps?.data;
    if (f?.['shakti.graphql.deployedClientUrl'] !== '/graphql' || f?.['shakti.graphql.localClientUrl'] || f?.['shakti.graphql.pre-persisted-queries.enable'] !== true) fault('endpoint_unsupported');
    const locale = m?.geo?.data?.locale;
    if (typeof locale?.id !== 'string' || locale.id.length > 64 || !['ltr', 'rtl'].includes(locale.dir)) fault('variables_unsupported');
    const model = m?.abProperties?.data;
    const edd = model == null ? false : model.properties?.enableEDD;
    if (typeof edd !== 'boolean') fault('variables_unsupported');
    const lower = f['shakti.graphql.useLowercaseLocale'];
    if (typeof lower !== 'boolean') fault('variables_unsupported');
    const language = lower ? locale.id.toLocaleLowerCase() : new Intl.Locale(locale.id).toString();
    return { dir: locale.dir, edd, language, fingerprint: JSON.stringify([config.build, scripts[0].src, locale.dir, edd, language, f['shakti.graphql.localClientUrl'] || null]) };
  }
  function artwork(dir) {
    const F = ['WEBP','JPG','PNG'], S = {width:342,height:192}, H = {width:665,height:375}, I = {width:200,height:200};
    const still = () => ({artworkType:'SDP',dimension:S,features:{fallbackStrategy:'STILL'}});
    const hi = lock => ({artworkType:'SDP',dimension:H,features:{fallbackStrategy:'STILL',...(lock ? {enableLockBadgeChecks:true} : {})}});
    return {
      imageParamsForStandardBoxart:{...still(),features:{enableLockBadgeChecks:true,fallbackStrategy:'STILL'}},
      imageParamsForStandardBoxartHighRes:hi(true),
      imageParamsForPodcastEpisodicStill:{artworkType:'SEGMENT_STILL',dimension:{...S,scaleStrategy:'COVER'},features:{graybox:false}},
      imageParamsForPodcastEpisodicStillHighRes:{artworkType:'SEGMENT_STILL',dimension:{...H,scaleStrategy:'COVER'},features:{graybox:false}},
      imageParamsForPodcastEpisodicLogo:{artworkType:'LOGO_HORIZONTAL_CROPPED',dimension:{width:800,height:126,scaleStrategy:'CONTAIN'},features:{tone:'LIGHT'}},
      imageParamsForRankedBoxart:{artworkType:'BOXSHOT',dimension:{width:426,height:607},features:{fallbackStrategy:'STILL',suppressTop10Badge:true}},
      imageParamsForContinueWatchingBoxart:still(), imageParamsForContinueWatchingBoxartHighRes:hi(),
      imageParamsForCloudGameBoxart:still(), imageParamsForCloudGameBoxartHighRes:hi(),
      imageParamsForMobileGameBoxart:{artworkType:'APP_ICON',dimension:I,formats:F},
      imageParamsForCharacterCircle:{artworkType:'SQUAREHEADSHOT_1000x1000',dimension:I,formats:F},
      imageParamsForChannel:{artworkType:dir === 'rtl' ? 'CHANNEL_TILE_BACKGROUND_RTL' : 'CHANNEL_TILE_BACKGROUND',dimension:S,formats:F},
      imageParamsForChannelLogo:{artworkType:'CHANNEL_LOGO_COLOR_CROPPED',dimension:{height:44},formats:['WEBP','PNG']},
      imageParamsForEntryPointBackground:{artworkType:dir === 'rtl' ? 'MLP_ENTRY_POINT_BACKGROUND_RTL' : 'MLP_ENTRY_POINT_BACKGROUND',dimension:{width:1024},features:{fallbackStrategy:'STILL'}},
      imageParamsForEntryPointLogo:{artworkType:'LOGO_STACKED_CROPPED',dimension:{height:260},formats:F},
    };
  }
  function request(ref, after, size, s) {
    const variables = {rowId:ref.rowId, carouselAfterCursor:after, carouselPageSize:size, carouselVersion:ref.version,
      eddEnabled:s.edd, fetchHighResCards:false, includeSearchDestinationCards:false, ...artwork(s.dir)};
    const headers = {
      'content-type':'application/json', accept:'*/*', 'x-netflix.context.ui-flavor':'akira',
      'X-Netflix.Request.Originating.Url':location.href, 'x-netflix.context.operation-name':'CarouselPage',
      'x-netflix.context.app-version':config.build, 'x-netflix.context.locales':s.language,
      'x-netflix.context.hawkins-version':config.hawkins, 'x-netflix.request.id':crypto.randomUUID().replaceAll('-', ''),
      'x-netflix.request.attempt':'1', 'X-Netflix.request.toplevel.uuid':crypto.randomUUID(),
      'x-netflix.request.client.context':JSON.stringify({appstate:document.hidden ? 'background' : 'foreground'}),
    };
    return {variables, headers, body:JSON.stringify({operationName:'CarouselPage',variables,extensions:{persistedQuery:{id:config.documentId,version:102}}})};
  }
  function parse(json, ref, after, size) {
    if (!json || typeof json !== 'object') fault('response_json');
    if (Object.hasOwn(json, 'errors')) fault('response_errors');
    const n = json.data?.node;
    if (n?.__typename !== 'PinotCarouselSection') fault('response_node');
    if (n._id !== ref.rowId) fault('response_row_id');
    if (n.displayString !== ref.label) fault('response_label');
    if (n.version !== ref.version) fault('response_version');
    const connections = Object.keys(n).filter(k => /^entities(\(|$)/.test(k));
    if (connections.length !== 1) fault('response_connection');
    const c = n[connections[0]];
    if (!Number.isSafeInteger(c?.totalCount) || c.totalCount < 1 || c.totalCount > 5000 || c.totalCount !== ref.total) fault('response_total');
    if (!Array.isArray(c.edges) || !c.edges.length || c.edges.length > size) fault('response_positions');
    const entries = [], ids = new Set(), positions = new Set();
    for (const edge of c.edges) {
      const p = position(edge?.cursor);
      if (p === null) fault('response_cursor');
      if (positions.has(p)) fault('position_duplicate');
      if (p >= ref.total) fault('response_positions');
      if (p !== after + 1 + entries.length) fault('position_gap');
      positions.add(p);
      const e = edge.node?.unifiedEntity, key = id(e?.videoId);
      if (!key || !text(edge.node?.displayString)) fault('response_entity');
      if (!['Movie','Show'].includes(e.__typename)) fault('entity_type_unknown');
      if (ids.has(key)) fault('id_conflict');
      ids.add(key); entries.push({id:key, title:edge.node.displayString, entityType:e.__typename, position:p});
    }
    const last = after + entries.length;
    if (c.pageInfo?.endCursor !== c.edges.at(-1).cursor) fault('response_end_cursor');
    if (c.pageInfo?.hasNextPage !== (last < ref.total - 1)) fault('response_has_next');
    return {entries, cursor:c.pageInfo.endCursor, hasNext:c.pageInfo.hasNextPage, last};
  }
  globalThis.GWS5Adapter = {settings, request, parse, position, id, fixture:config?.fixture === true};
})();
