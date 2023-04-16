import {runMainDataFetchingLoop} from "./src/main";
import {executeSqlFromFile} from "./src/db/db";

async function run() {
  await executeSqlFromFile('src/db/init/mediaTables.sql')
  await runMainDataFetchingLoop()
  // await runScraper()
}

run()