import { IMDbScraper } from './src/imdb-scraper'
import { MetacriticScraper } from './src/metacritic-scraper'
import { RottenTomatoesScraper } from './src/rottentomatoes-scraper'

async function main() {
  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()

  const imdbRatings = await imdbScraper.getRatings('tt1630029')
  const metacriticRatings = await metacriticScraper.getMovieRatings('avatar-the-way-of-water')
  const rottenTomatoesRatings = await rottenTomatoesScraper.getMovieRatings('avatar_the_way_of_water')

  console.log({
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  })
}

main()