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
    {description: 'All movie and tv show ratings and streaming providers on the same page'},
  ]
}

export default function Disclaimer() {
  return (
    <div className="flex flex-col items-center mt-0 py-2 md:py-4 lg:py-8">
      <h1 className="mb-8 text-3xl font-semibold">About GoodWatch</h1>

      <h2 className="mt-8 mb-4 text-2xl font-bold">Why?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          I wanted a website that would help me discover new movies and TV shows. Main requirements were to have a list of all streaming services and their ratings.
        </p>
        <p>
          There are plenty of other websites and apps that offer similar features. None of them had exactly what I needed. That's why I built GoodWatch.
        </p>
      </section>

      <h2 className="mt-8 mb-4 text-2xl font-bold">What's unique?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          GoodWatch is the only site (that I know of) that combines:
          <ol>
            <li>streaming information from most services (e.g. Netflix, Prime, etc.)</li>
            <li>scores from popular rating pages (e.g. IMDb, Metacritic, etc.)</li>
          </ol>
        </p>
      </section>

      <h2 className="mt-8 mb-4 text-2xl font-bold">What about website "xyz"?</h2>
      <section className="prose prose-invert lg:prose-xl mx-auto">
        <p>
          The closest offering to what I was looking for can be found on &nbsp;
          <a href="https://www.justwatch.com/" className="underline cursor-pointer" target="_blank" rel="noreferrer">JustWatch</a>.
        </p>
        <p>
          However, it lacks the aggregated scores from different sources.
        </p>
      </section>

    </div>
  );
}
