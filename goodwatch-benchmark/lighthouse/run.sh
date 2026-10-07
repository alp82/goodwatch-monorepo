#!/usr/bin/env bash
set -euo pipefail
: "${LH_URLS_FILE:=/work/urls.txt}"
: "${LH_RUNS:=3}"
: "${LH_OUT:=/out}"
# The CPU slowdown of Lighthouse's simulation. Lighthouse's own default of 4 is made for a host whose CPU benchmark
# is about 1,530. The generator's reads about 1,170, which Lighthouse's calculator maps to 2.7.
: "${LH_CPU_SLOWDOWN:=2.7}"
[[ $LH_RUNS =~ ^[1-9][0-9]*$ ]] || { echo 'LH_RUNS must be positive' >&2; exit 2; }
[[ $LH_CPU_SLOWDOWN =~ ^[0-9]+(\.[0-9]+)?$ ]] || { echo 'LH_CPU_SLOWDOWN must be a number, such as 2.7' >&2; exit 2; }
success=0
while read -r label url rest || [[ -n ${label:-} ]]; do
  [[ -z $label || $label == \#* ]] && continue
  [[ $label =~ ^[a-zA-Z0-9_-]+$ && $url =~ ^https?:// && -z $rest ]] || { echo "Invalid URL line: $label" >&2; exit 2; }
  mkdir -p "$LH_OUT/$label"
  # --hide-scrollbars: under mobile emulation, the blank page's overlay scrollbar fades out while the navigation
  # starts, and Chromium then holds the page's first frame until about one second after the fade's last frame.
  # The observed first paint moved from 0.3 s to 1.3 or 2.3 s, and Lighthouse's simulation starts from it.
  flags="--headless=new --no-sandbox --disable-dev-shm-usage --hide-scrollbars ${LH_EXTRA_CHROME_FLAGS:-}"
  if [[ -n ${LH_RESOLVE_IP:-} ]]; then
    host=${url#*://}; host=${host%%/*}; host=${host%%:*}
    flags+=" --host-resolver-rules=\"MAP $host $LH_RESOLVE_IP\""
  fi
  # Requests that the browser must not send because they change server state. No landing page sends one today:
  # the default pattern is left from the warm request that every page view sent until October 4, 2026.
  blocked=()
  for pattern in ${LH_BLOCKED_URL_PATTERNS-*/api/og-image-warm*}; do blocked+=("--blocked-url-patterns=$pattern"); done
  for ((n=1;n<=LH_RUNS;n++)); do
    if lighthouse "$url" "${blocked[@]}" --only-categories=performance --form-factor=mobile --throttling.cpuSlowdownMultiplier="$LH_CPU_SLOWDOWN" --output=json --output-path="$LH_OUT/$label/run-$n.json" --quiet --chrome-flags="$flags"; then
      success=$((success + 1))
    else
      echo "Lighthouse failed: $label run $n" >&2
    fi
  done
done < "$LH_URLS_FILE"
((success > 0))
