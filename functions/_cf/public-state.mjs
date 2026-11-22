// Cloudflare port of netlify/lib/ncn-public-state.mjs.
//
// The original reads seed JSONs with node:fs at module load and calls
// getStore() from @netlify/blobs directly, so it cannot be imported on
// Workers. This port keeps the same exported behaviour (currentPublicState /
// currentNews / publicSeed / newsSeed) but takes the store factory as an
// argument and imports the seeds as JSON modules (bundled by esbuild).

import {readLibrary, publicCatalog} from '../../netlify/lib/ncn-library-api.mjs';
import {readGenkNews, mergeNews} from '../../netlify/lib/ncn-news.mjs';
import {readPublicStories} from '../../netlify/lib/ncn-stories-public.mjs';
import publicSeedJson from '../../netlify/lib/ncn-library/seed.json';
import genkSeedJson from '../../netlify/lib/ncn-news/genk-seed.json';

export const publicSeed = publicSeedJson;
export const newsSeed = genkSeedJson;

export function createPublicState(getStore) {
  const store = name => getStore(name);
  const currentNews = () => readGenkNews(store('ncn-genk-feed-v1'), newsSeed);
  async function currentPublicState({stories = false, catalog = true} = {}) {
    const now = Date.now();
    const [library, news, notices, photos] = await Promise.all([
      catalog ? readLibrary(store('ncn-site-library-v1')) : Promise.resolve(null),
      catalog ? currentNews() : Promise.resolve([]),
      store('ncn-site-announcements-v1').get('announcements', {type: 'json'}).catch(() => null),
      stories ? readPublicStories(store('ncn-community-stories-v1'), now).catch(() => []) : Promise.resolve([])
    ]);
    return {index: library?.data, catalog: catalog ? mergeNews(publicCatalog(publicSeed, library?.data), news) : [], catalogDeferred: !catalog, notices: notices?.items || [], stories: photos, now};
  }
  return {currentPublicState, currentNews};
}
