// Captures #534 against the isolated localhost dev server. No production pages or services.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const require = createRequire(process.env.PLAYWRIGHT ?? '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/package.json')
const { chromium } = require('playwright-core')
const dir = dirname(fileURLToPath(import.meta.url))
const origin = 'http://127.0.0.1:3114'
const cases = [
  ['sign-in','A','default',1],['sign-in','B','default',1],
  ['sign-up','A','default',1],['sign-up','B','default',1],
  ['reset-request','A','default',2],['reset-request','A','sent',2],
  ['reset-new','A','default',3],['reset-new','A','expired',3],
  ['verify','A','default',4],['verify','A','success',4],['verify','A','expired',4],
  ['cutover','A','default',5],['cutover','B','default',5],
  ['consent','A','default',6],['consent','B','default',6],
  ['connected','A','default',7],['connected','B','default',7],['connected','A','empty',8],['connected','A','disconnect',8],
]
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
const errors = [], blocked = new Set(), captures = []
mkdirSync(join(dir, 'screenshots'), { recursive: true })
for (const [device,width,height] of [['desktop',1440,1000],['phone',390,844]]) {
  const page = await browser.newPage({ viewport: { width,height }, ...(device === 'phone' ? {isMobile:true,hasTouch:true,deviceScaleFactor:1} : {}) })
  page.setDefaultTimeout(30000)
  page.on('pageerror', error=>errors.push(error.message))
  await page.route('**/*', async route=> {
    const url = new URL(route.request().url())
    if (url.origin !== origin || url.pathname === '/api/e') {
      blocked.add(url.origin + url.pathname)
      return route.fulfill({status:200,contentType:'application/json',body:'{}'})
    }
    return route.continue()
  })
  // Warm Vite before the actual capture: its first optimization can reload the page.
  await page.goto(origin+'/prototype/auth',{waitUntil:'load',timeout:120000})
  await page.locator('.ap-card').waitFor()
  for (const [screen,variant,state,question] of cases) {
    await page.setViewportSize({width,height})
    const query = `screen=${screen}&variant=${variant}${state !== 'default' ? '&state='+state : ''}`
    await page.goto(origin+'/prototype/auth?'+query,{waitUntil:'load',timeout:120000})
    await page.locator('.ap-surface h1').waitFor()
    await page.evaluate(()=>document.fonts.ready)
    // Keep the complete page visible at phone width, with dock + switcher below the content.
    // Tall viewport captures avoid fixed controls covering a permission list in a full-page image.
    const contentBottom = await page.locator('.ap-demo-state').evaluate(el=>Math.ceil(el.getBoundingClientRect().bottom))
    const captureHeight = Math.max(height, contentBottom + 155)
    await page.setViewportSize({width,height:captureHeight})
    if (state === 'disconnect') {
      await page.locator('.ap-surface').getByRole('button',{name:'Disconnect Claude'}).click()
      await page.getByRole('dialog').waitFor()
    }
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth)
    if (overflow) throw new Error(`Horizontal overflow: ${device} ${query}`)
    const name = `${screen}-${variant}-${state}-${device}.jpg`
    await page.screenshot({ path: join(dir,'screenshots',name), type:'jpeg',quality:82,clip:{x:0,y:0,width,height:captureHeight}, animations:'disabled' })
    captures.push({screen,variant,state,question,device,width,height:captureHeight,file:'screenshots/'+name,url:origin+'/prototype/auth?'+query})
    console.log(`Captured ${name}`)
  }
  await page.close()
}
await browser.close()
writeFileSync(join(dir,'captures.json'),JSON.stringify({captures,errors:[...new Set(errors)],blocked:[...blocked]},null,2)+'\n')
if (errors.length) throw new Error('Browser errors: '+[...new Set(errors)].join('; '))
