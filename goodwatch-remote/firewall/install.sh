#!/bin/sh
# Install artifacts only. Inspect the dry-run plan before starting the timer.
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Root required' >&2; exit 1; }
[ "$#" -eq 1 ] || { echo 'Usage: install.sh CONFIG_JSON' >&2; exit 1; }
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
install -d -m 0755 /usr/local/lib/goodwatch-worker-firewall
install -d -m 0700 /var/lib/goodwatch-worker-firewall
install -o root -g root -m 0644 "$source_dir/reconcile.py" /usr/local/lib/goodwatch-worker-firewall/reconcile.py
install -o root -g root -m 0755 "$source_dir/run.sh" /usr/local/lib/goodwatch-worker-firewall/run.sh
install -o root -g root -m 0600 "$1" /etc/goodwatch-worker-firewall.json
install -o root -g root -m 0644 "$source_dir/goodwatch-worker-firewall.service" /etc/systemd/system/goodwatch-worker-firewall.service
install -o root -g root -m 0644 "$source_dir/goodwatch-worker-firewall.timer" /etc/systemd/system/goodwatch-worker-firewall.timer
systemctl daemon-reload
/usr/bin/python3 /usr/local/lib/goodwatch-worker-firewall/reconcile.py --config /etc/goodwatch-worker-firewall.json
