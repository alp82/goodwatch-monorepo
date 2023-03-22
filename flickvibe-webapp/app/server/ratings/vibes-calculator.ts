import { IMDbRatings } from '~/server/ratings/imdb-scraper'
import { MetacriticRatings } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings } from '~/server/ratings/rottentomatoes-scraper'

export interface VibeRatings {
  vibes?: number
}

export interface getVibesProps {
  imdbRatings: IMDbRatings,
  metacriticRatings: MetacriticRatings,
  rottenTomatoesRatings: RottenTomatoesRatings,
}

export class VibesCalculator {

  getVibes({
    imdbRatings, metacriticRatings, rottenTomatoesRatings,
  }: getVibesProps): VibeRatings {
    const scores = []
    if (imdbRatings.score) {
      scores.push(parseFloat(imdbRatings.score) * 10)
    }
    if (metacriticRatings.metaScore) {
      scores.push(parseFloat(metacriticRatings.metaScore))
    }
    if (metacriticRatings.userScore) {
      scores.push(parseFloat(metacriticRatings.userScore) * 10)
    }
    if (rottenTomatoesRatings.tomatometer) {
      scores.push(parseFloat(rottenTomatoesRatings.tomatometer))
    }
    if (rottenTomatoesRatings.audienceScore) {
      scores.push(parseFloat(rottenTomatoesRatings.audienceScore))
    }
    const vibes = Math.round(
      scores.reduce((sum, score) => {
        return sum + score
      }, 0) / scores.length
    )
    return {
      vibes,
    }
  }

}