import { importDailyTMDBEntries } from './src/tmdb-daily'
import { runScraper } from './src/scraper'

async function run() {
  // await importDailyTMDBEntries()
  await runScraper()
}

run()