# NCN authoritative arena host

From the repository root:

```sh
npm ci --prefix server/arcade --omit=dev --ignore-scripts
NCN_SITE_URL=https://nguyencongnghe.com node server/arcade/index.mjs
```

Set `PORT` as required by the host. The website's verified Identity service issues join tickets; this process runs physics and signs terminal scores. Only public signing keys cross between hosts. Long-lived private keys or deployment credentials are never returned to clients.

Use **one instance**. Active rooms are in memory; saved rankings and membership are on Netlify. See [deployment and validation](../../docs/ran-luot-online-20261025.md).
