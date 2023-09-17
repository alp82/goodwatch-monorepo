import {runMainDataFetchingLoop} from "./src/main";
import {executeSqlFromFile} from "./src/db/db";

async function run() {
  await executeSqlFromFile('src/db/init/tables.sql')
  await runMainDataFetchingLoop()
}

run()