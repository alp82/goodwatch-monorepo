# Preparing the Explore hubs

One systemd timer on abio runs the healthy webapp image in its own short-lived container. It checks the catalog manifest and the three cache markers every two minutes. When the version or UTC day changes, or when an entry disappears, the job loads the published snapshot and builds the missing default US English hubs one at a time. The worker writes the same neutral Redis entries that the page loaders read. The visitor’s own marks are applied by the loader.

The container has a 2 GiB memory limit and one CPU. It joins the existing Coolify network and listens on no ports. The launcher passes the Crate and Redis settings from the healthy page container directly through the environment. A failed prerequisite, degraded media read, or changed version leaves the previous entry in place. A later run retries.

Install these three files on abio after deploying an image containing the worker.

```sh
install -Dm755 run.sh /usr/local/lib/goodwatch/explore-hubs/run.sh
install -m644 goodwatch-explore-hubs.{service,timer} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now goodwatch-explore-hubs.timer
systemctl start goodwatch-explore-hubs.service
journalctl -u goodwatch-explore-hubs.service -n 12
```

To suspend preparation, run `systemctl disable --now goodwatch-explore-hubs.timer`. The webapp can still build any hub on request.
