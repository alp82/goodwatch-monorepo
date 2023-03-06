import { MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
  return {
    title: 'flickvibe',
    description: 'All movie and tv show ratings and streaming providers on the same page',
  }
}

export default function Index() {
  return (
    <div>
      <h2 className="my-4 text-3xl font-bold">Welcome</h2>
      <div>
        <div className="">Search above and select a movie or tv show. You can then check ratings and streaming providers on one page.</div>
      </div>
    </div>
  );
}
