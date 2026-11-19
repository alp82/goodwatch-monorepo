// Run in a separate `docker exec -i goodwatch-search-a node` process.
// Creates only an isolated Express app; never changes the serving app.
const express = require('/app/node_modules/express')
const { createRemixRequest } = require('/app/node_modules/@remix-run/express/dist/server.js')
const app = express()
const request = Object.create(app.request)
request.app = app
request.connection = { encrypted: false, remoteAddress: '127.0.0.1' }
request.headers = { host: 'goodwatch.app', 'x-forwarded-proto': 'https' }
request.originalUrl = '/mcp'
request.method = 'GET'
const response = { on() {} }
console.log(JSON.stringify({
  case: 'installed_default', protocol: request.protocol,
  url: createRemixRequest(request, response).url,
}))
app.set('trust proxy', 'loopback')
console.log(JSON.stringify({
  case: 'isolated_harness_trusts_loopback', protocol: request.protocol,
  url: createRemixRequest(request, response).url,
}))
