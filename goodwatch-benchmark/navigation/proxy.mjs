// Local reverse proxy to production for what-if tests. DATA_CC sets Cache-Control on 200 `_data` responses.
import http from 'node:http'
import https from 'node:https'
const PORT = Number(process.env.PORT), DATA_CC = process.env.DATA_CC || ''
const agent = new https.Agent({ keepAlive: true, maxSockets: 64 })
http.createServer((req, res) => {
	const headers = { ...req.headers, host: 'goodwatch.app' }
	delete headers.origin; delete headers.referer
	const up = https.request({ host: 'goodwatch.app', path: req.url, method: req.method, headers, agent }, (r) => {
		const h = { ...r.headers }
		delete h['strict-transport-security']
		if (h.location) h.location = h.location.replace('https://goodwatch.app', `http://localhost:${PORT}`)
		if (DATA_CC && r.statusCode === 200 && /[?&]_data=/.test(req.url)) h['cache-control'] = DATA_CC
		res.writeHead(r.statusCode, h)
		r.pipe(res)
	})
	up.on('error', () => { res.writeHead(502); res.end() })
	req.pipe(up)
}).listen(PORT, '127.0.0.1', () => console.log('proxy on', PORT, 'DATA_CC=' + DATA_CC))
