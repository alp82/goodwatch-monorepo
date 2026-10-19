// Writes a synthetic 77-row packet with the same shape as the private #709 packet.
// Titles are well-known public films and shows. Netflix ids are made up.
// node make-synthetic.mjs [OUTPUT]  (default ~/.cache/gw709-review-page/synthetic/review.json)
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const out = resolve(process.argv[2] ?? join(process.env.HOME, '.cache/gw709-review-page/synthetic/review.json'));
// [netflix title, netflix year, tmdb id, title, original title, year, mediaType]
const seeds = [
  ['Spirited Away', 2001, 129, 'Spirited Away', '千と千尋の神隠し', 2001, 'movie'],
  ['Stranger Things', null, 66732, 'Stranger Things', 'Stranger Things', 2016, 'show'],
  ['Roma', 2018, 426426, 'Roma', 'Roma', 2018, 'movie'],
  ['The Crown: Season 1', null, 65494, 'The Crown', 'The Crown', 2016, 'movie'], // movie vs show trap
  ['Dark', 2017, 70523, 'Dark', 'Dark', 2017, 'show'],
  ['Parasite', 2019, 496243, 'Parasite', '기생충', 2019, 'movie'],
  ['Little Women', 1994, 331482, 'Little Women', 'Little Women', 2019, 'movie'], // year trap
  ['Money Heist', null, 71446, 'Money Heist', 'La casa de papel', 2017, 'show'],
  ['Amélie', 2001, 194, 'Amélie', 'Le Fabuleux Destin d\'Amélie Poulain', 2001, 'movie'],
  ['The Irishman', 2019, 398978, 'The Irishman', 'The Irishman', 2019, 'movie'],
  ['Squid Game', null, 93405, 'Squid Game', '오징어 게임', 2021, 'show'],
  ['Okja', 2017, 387426, 'Okja', 'Okja', 2017, 'movie'],
  ['My Neighbor Totoro', 1988, 8392, 'My Neighbor Totoro', 'となりのトトロ', 1988, 'movie'],
  ['Mindhunter', null, 67744, 'Mindhunter', 'Mindhunter', 2017, 'show'],
  ['Marriage Story', 2019, 492188, 'Marriage Story', 'Marriage Story', 2019, 'movie'],
  ['Princess Mononoke', 1998, 128, 'Princess Mononoke', 'もののけ姫', 1997, 'movie'], // off by one
];
const entries = Array.from({ length: 77 }, (_, index) => {
  const [title, year, tmdb_id, ptitle, original_title, release_year, mediaType] = seeds[index % seeds.length];
  const manual = index === 20 || index === 55;
  return {
    index,
    source: { title: manual ? `Synthetic manual row ${index}` : title, sourceId: String(90000000 + index), year: manual ? null : year },
    historicalProposal: manual ? null : { tmdb_id, title: ptitle, original_title, release_year, adult: false, mediaType },
    review: '-',
  };
});
await mkdir(dirname(out), { recursive: true, mode: 0o700 });
await writeFile(out, `${JSON.stringify({ warning: 'SYNTHETIC test packet', instructions: ['Synthetic packet for testing the review page.'], entries }, null, 2)}\n`, { mode: 0o600 });
console.log(`Synthetic packet: ${out} (77 rows, 75 proposals, 2 manual)`);
