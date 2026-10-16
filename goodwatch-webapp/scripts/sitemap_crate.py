"""The Crate connection of create_sitemaps.py, from CRATE_HOSTS, CRATE_PORT, CRATE_USER and CRATE_PASS.

The credentials go to the driver apart from the URL: in a URL, a password with "#", "/" or "?" breaks the address
(#562). Without CRATE_USER no credentials are sent, which works only while the cluster does not enforce passwords."""


def connect_args(environ):
    """Returns (servers, keyword arguments) for crate.client.connect. Only the first host is used, as before."""
    hosts = [host.strip() for host in environ.get("CRATE_HOSTS", "").split(",") if host.strip()]
    if not hosts:
        raise ValueError("CRATE_HOSTS environment variable is not set")
    servers = f"http://{hosts[0]}:{environ.get('CRATE_PORT') or '4200'}"
    user = environ.get("CRATE_USER", "")
    if not user:
        return servers, {}
    return servers, {"username": user, "password": environ.get("CRATE_PASS", "")}
