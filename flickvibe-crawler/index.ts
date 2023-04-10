import { importDailyTMDBEntries } from './src/tmdb-daily'
import { runScraper } from './src/scraper'
import {runMainDataFetchingLoop} from "./src/main";

async function run() {
  // await importDailyTMDBEntries()
  // await runScraper()
  runMainDataFetchingLoop()
}

run()