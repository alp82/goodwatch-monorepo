import { MetaFunction } from '@remix-run/node'
import { loader } from '~/routes/discover'

export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [
    {title: 'About | GoodWatch'},
    {description: 'FAQ for GoodWatch. All movie and tv show ratings and streaming providers on the same page'},
  ]
}

export default function About() {
  return (
    <div className="flex flex-col items-center mt-0 py-2 md:py-4 lg:py-8">
      <h1 className="mb-8 text-3xl font-semibold">About GoodWatch / FAQ</h1>

      <h2 className="mt-12 mb-4 text-2xl font-bold">Why?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          I wanted a website that would help me discover new movies and TV shows.
          I used to visit IMDb, Metacritic, Rotten Tomatoes and JustWatch to determine what I want to watch next.
          I didn't like the overhead of jumping between those pages and looked for pages that aggregate all this
          information.
        </p>
      </section>

      <h2 className="mt-12 mb-4 text-2xl font-bold">What's unique?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          GoodWatch is the only site (that I know of) that combines:
          <ol>
            <li>streaming information from most services (e.g. Netflix, Prime, etc.)</li>
            <li>scores from popular rating pages (e.g. IMDb, Metacritic, Rotten Tomatoes)</li>
          </ol>
        </p>
      </section>

      <h2 className="mt-12 mb-4 text-2xl font-bold">What about website "xyz"?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          There are plenty of other websites and apps that offer similar features. None of them had exactly what I
          needed. That's why I built GoodWatch.
        </p>
        <p>
          The closest offering to what I was looking for can be found on &nbsp;
          <a href="https://www.justwatch.com/" className="underline cursor-pointer" target="_blank"
             rel="noreferrer">JustWatch</a>.
          However, it lacks the aggregated scores from different sources.
        </p>
      </section>

      <h2 className="mt-12 mb-4 text-2xl font-bold">What do you plan for the future?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          A truly personalized recommendation system that understands your taste in movies and TV shows.
        </p>
        <p>
          Each title has certain categories like mood, plot, narrative, visual style or place.
          The combined data is called the Genome or DNA. This will be the foundation for exploration
          and recommendation features that are unique across all media.
        </p>
      </section>

    </div>
  );
}
