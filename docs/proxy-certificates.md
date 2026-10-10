# Proxy certificates: from RSA 4096 to ECDSA

How abio's proxy gets its certificates, why the certificate for `goodwatch.app` has an RSA 4096 key, and how the owner switches it to ECDSA P-256. Researched and tested locally on October 5, 2026, for "Switch the proxy's certificate from RSA 4096 to ECDSA". Nothing on a host was changed.

**State since October 7, 2026:** the owner made the switch. The certificate for `goodwatch.app` has an ECDSA P-256 key, read from production again on October 9, 2026. "What runs today" below describes the state before the switch.

Why it matters: a new TLS connection costs 14 to 16 ms of proxy CPU on abio, almost all of it the RSA 4096 signature ([viral-spike-page-views.md](benchmarks/viral-spike-page-views.md)).

## What runs today

Read from the running proxies and from Coolify 4.3.23.

| Item | abio | vector1 |
| --- | --- | --- |
| Proxy | Traefik 2.10.7 (image `traefik:v2.10`), Go 1.21.5 | Traefik 3.6 |
| Where its arguments live | `/data/coolify/proxy/docker-compose.yml`, the `command:` list. Coolify writes the file from **Servers > abio > Proxy > Configuration** | The same path and page for vector1 |
| Certificate resolver | One, `letsencrypt`: HTTP challenge on the `http` entry point, storage `/traefik/acme.json` (on the host: `/data/coolify/proxy/acme.json`) | The same arguments |
| Key type | No `keytype` argument, so Traefik's default applies: `RSA4096` | The same |
| Stored certificates | 15, one per name, no alternative names. All have RSA 4096 keys. Eight are `goodwatch.app` names, seven belong to other projects | None. Visitors never reach vector1's HTTPS entry point |
| `goodwatch.app` | Valid until December 14, 2026 | |
| Who asks for it | Two routers with `certResolver: letsencrypt`: Coolify's `https-0-gk4owk8` from the container's labels, and `gw-webapp-https` from `goodwatch-balance.yaml` | |

`acme.json` holds the private keys. Never print it. To list names and key sizes only:

```sh
f=/data/coolify/proxy/acme.json
for i in $(seq 0 $(($(jq '.letsencrypt.Certificates | length' $f) - 1))); do
  echo "$(jq -r ".letsencrypt.Certificates[$i].domain.main" $f)" \
    "$(jq -r ".letsencrypt.Certificates[$i].certificate" $f | base64 -d | openssl x509 -noout -text | grep 'Public-Key')"
done
```

## What a changed key type does

The key type is a static argument of the resolver: `--certificatesresolvers.letsencrypt.acme.keytype=EC256`. It applies only when Traefik creates a key, which it does only for a name that has no stored certificate.

| Question | Answer | How it's known |
| --- | --- | --- |
| Does Traefik issue a new certificate when the key type changes? | No. A name with a stored certificate is skipped | Source (`getUncheckedDomains` in `pkg/provider/acme/provider.go`, v2.10.7), and the local test |
| Does the next renewal change the key? | No. A renewal sends the stored key again, so the certificate stays RSA 4096 for good | Source (`renewCertificates` passes `PrivateKey: cert.Key`, and lego v4.14.0 reuses it), and the local test: a renewal with `keytype=EC256` gave a new serial number and the same 4,096 bits |
| When does a name get an ECDSA key? | When its entry is gone from `acme.json` at the proxy's start | The local test |
| Does a second resolver with `EC256` help? | No. A resolver issues nothing for a name that any stored certificate already covers. The log says `No ACME certificate generation required for domains ["goodwatch.app"]`, and the RSA certificate stays in use | Source and the local test. Coolify's own router for the name also stays on the first resolver |
| Does the account's key matter? | No. It's RSA 4096 whatever the key type, and Traefik never compares it | Source (`account.go`) |
| Is there an option to stop the key reuse? | Not in 2.10. Traefik's issue "Support disabling private key reuse in certificate renewal" was closed by a change that isn't in this version | Traefik's issue tracker |

So the plan with a second resolver doesn't work. What works is one argument for the one resolver, plus removing the entry of each name that should change. Every other name keeps its RSA key through all renewals. A name that is added later gets an ECDSA key.

## The local test

A Traefik 2.10.7 container with abio's resolver arguments, and [Pebble](https://github.com/letsencrypt/pebble) as the certificate authority, with certificates that last 10 days so that every start renews them. Two names: `goodwatch.app` and one stand-in for the other projects.

| Step | Served for `goodwatch.app` | Served for the other name |
| --- | --- | --- |
| Start with today's arguments | RSA 4096 | RSA 4096 |
| Add `keytype=EC256`, restart (both renew) | RSA 4096, new serial number | RSA 4096, new serial number |
| Add a second resolver with `EC256` and its own storage, move the router to it, restart | RSA 4096. The second storage stays empty | RSA 4096 |
| Stop, remove the `goodwatch.app` entry, start with `keytype=EC256` | Traefik's default certificate for 1.3 seconds, then ECDSA P-256 | RSA 4096 |
| Stop, replace the entry's certificate and key with an ECDSA pair from another client, start (both renew) | ECDSA P-256 from the first connection, and still after the renewal | RSA 4096 |

## Handshake cost, measured

The same Traefik 2.10.7 image on a desktop (Ryzen 9 9950X3D), with self-signed certificates as the default certificate. Two `openssl s_time -new` clients for 8 seconds, no request sent. Proxy CPU from the container's `cpu.stat`.

| Certificate key | Protocol | New connections per second | Proxy CPU per connection |
| --- | --- | --- | --- |
| RSA 4096 | TLS 1.3 | 512 | 4.1 ms |
| RSA 4096 | TLS 1.2 | 538 | 4.0 ms |
| RSA 2048 | TLS 1.3 | 1,915 | 0.90 ms |
| ECDSA P-256 | TLS 1.3 | 4,680 to 4,770 | 0.28 ms |
| ECDSA P-256 | TLS 1.2 | 6,183 | 0.18 ms |

- **ECDSA P-256 costs 7% of RSA 4096 here:** 0.28 ms against 4.1 ms. The clients were the limit in the ECDSA runs, not the proxy.
- **On abio the same ratios fit the earlier numbers:** RSA 4096 is 3.5 times RSA 2048 there (14.3 against 4.0 ms) and 4.6 times here. With the ECDSA share, abio's 14 to 16 ms become about 1 ms, close to its 0.8 ms for a resumed handshake. The ticket's estimate of 13 ms saved holds.
- **For a movie page view** with two new connections, that takes about 26 ms off the proxy's 53 ms.

The number on abio itself comes from the benchmark's TLS ramp after the switch (step 7 below).

## Let's Encrypt limits

From [letsencrypt.org/docs/rate-limits](https://letsencrypt.org/docs/rate-limits/) on October 5, 2026. The switch is one new order for one name.

| Limit | Value | Room |
| --- | --- | --- |
| New certificates for the same exact set of names | 5 in 7 days, for all accounts together | The last one for `goodwatch.app` is from mid-September |
| New certificates per registered domain | 50 in 7 days | Eight names on abio |
| New orders per account | 300 in 3 hours | |
| Failed validations per name | 5 in an hour | Stop after two failed starts and read the proxy's log |

## Clients

- **Browsers:** every browser on a system that still gets a current TLS stack can use an ECDSA P-256 certificate. Known to fail, from secondary sources: Internet Explorer and Chrome on Windows XP, and Java 6 without an extra provider. Their share of the site's visitors wasn't measured.
- **Crawlers and link previews:** no list per crawler was found. The indirect evidence: Cloudflare's free plan serves ECDSA certificates only ("only compatible with browsers that support ECDSA", [Cloudflare's browser compatibility page](https://developers.cloudflare.com/ssl/reference/browser-compatibility/)), and those sites are crawled and previewed everywhere.
- **TLS 1.2 clients** need an `ECDHE-ECDSA` cipher suite. Traefik offers them: the local TLS 1.2 run above used one.
- **The chain:** today's certificates come from the intermediates `YR1` and `YR2`. Which intermediate and root an ECDSA certificate gets wasn't checked. Step 6 below shows it.
- **After the switch,** watch for a day: Search Console's crawl stats (host status, "Server connectivity"), and one link preview each in the messengers that matter.

## Owner steps

Agents don't change the proxy or Coolify. Pick a quiet hour.

What visitors see: the restart refuses connections to every site on abio for a few seconds. Then `goodwatch.app` answers new connections with Traefik's self-signed default certificate until Let's Encrypt has issued the new one. That took 1.3 seconds against the local test authority and wasn't measured against Let's Encrypt; expect some seconds. Browsers show a certificate warning in that window.

1. In Coolify, open **Servers**, then **abio**, then **Proxy**, then **Configuration**. In the section **Traefik configuration**, the editor is labeled **Configuration file · /data/coolify/proxy/docker-compose.yml**.
2. Add one line to the `command:` list, after the other `certificatesresolvers` lines, and save. Don't restart yet. The page now says "Restart the proxy to apply the saved configuration."

   ```yaml
         - '--certificatesresolvers.letsencrypt.acme.keytype=EC256'
   ```

3. On abio, keep a copy of the storage and remove the one entry. The running proxy doesn't read the file again, so nothing changes yet.

   ```sh
   cd /data/coolify/proxy
   umask 077
   cp -p acme.json acme.json.before-ec256
   jq '.letsencrypt.Certificates |= map(select(.domain.main != "goodwatch.app"))' acme.json.before-ec256 > acme.json.new
   jq '.letsencrypt.Certificates | length' acme.json.before-ec256 acme.json.new   # 15, then 14
   cat acme.json.new > acme.json && rm acme.json.new                              # keeps the owner and mode 600
   ```

4. In Coolify, on the same server, choose **Restart Proxy** and confirm ("Confirm Proxy Restart?"). Do it right after step 3: a renewal by the running proxy would write the old content back.
5. Check that the argument arrived: `docker inspect coolify-proxy --format '{{json .Config.Cmd}}' | grep -o 'keytype=[A-Z0-9]*'` prints `keytype=EC256`.
6. Check the certificate from any machine. It must say `Public-Key: (256 bit)` and name a Let's Encrypt issuer.

   ```sh
   echo | openssl s_client -connect goodwatch.app:443 -servername goodwatch.app 2>/dev/null \
     | openssl x509 -noout -issuer -enddate -text | grep -E 'issuer|notAfter|Public-Key'
   ```

   If it still shows `TRAEFIK DEFAULT CERT` after one minute, read **Proxy > Logs** for a line with `acme` and `error`, and roll back.
7. Run `./bench.sh smoke` in `goodwatch-benchmark`, then the TLS ramp of [viral-spike-page-views.md](benchmarks/viral-spike-page-views.md) (`./bench.sh load --scenario page-view --urls handshake`), and compare the proxy CPU per connection with 14.3 ms.
8. After December 14, 2026, delete `acme.json.before-ec256`. It holds private keys.

`www.goodwatch.app` only redirects. To switch it too, remove its entry in the same step 3: add `and .domain.main != "www.goodwatch.app"` inside `select(...)`, and expect 13.

### Roll back

The old certificate is valid until December 14, 2026.

1. On abio, put the old entry back. This keeps whatever the other names renewed in the meantime.

   ```sh
   cd /data/coolify/proxy
   umask 077
   jq --slurpfile old acme.json.before-ec256 '.letsencrypt.Certificates |= (map(select(.domain.main != "goodwatch.app")) + ($old[0].letsencrypt.Certificates | map(select(.domain.main == "goodwatch.app"))))' acme.json > acme.json.new
   jq '.letsencrypt.Certificates | length' acme.json.new   # 15
   cat acme.json.new > acme.json && rm acme.json.new
   ```

2. In Coolify, remove the `keytype` line from the configuration, save, and choose **Restart Proxy**.
3. Run the check of step 6. It must say `Public-Key: (4096 bit)`.

Leaving the `keytype` line in place is also fine: with the old entry back, it changes nothing for existing names.

### Without the certificate warning

The window with the default certificate disappears when the new certificate exists before the restart: get an ECDSA P-256 certificate for `goodwatch.app` from Let's Encrypt with another ACME client and a DNS challenge, and in step 3 replace the entry's `certificate` and `key` (both Base64 of the PEM text) instead of removing the entry. The local test covers the replacing and the renewal that follows: the proxy served the ECDSA certificate from its first connection and kept the key through a renewal. Getting the certificate with a DNS challenge wasn't tested. The restart's few seconds remain either way.

## Not verified

- How long Let's Encrypt takes to issue through this proxy, and so how long the default certificate shows.
- Which intermediate and root the ECDSA certificate chains to.
- Any crawler or link preview against an ECDSA-only `goodwatch.app`.
- The handshake cost on abio after the switch.
- That Coolify's **Restart Proxy** leaves `acme.json` alone. The file's date (September 25) is older than the proxy's configuration file (October 4), which suggests it. If the count in step 3 is back at 15 after the restart, Coolify or a renewal rewrote the file: repeat steps 3 and 4.
