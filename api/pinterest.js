// api/pinterest.js — ilovepin.net scraper (ported from OurinMD bot)
const axios = require('axios');
const qs = require('qs');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'id,en;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
  'Origin': 'https://ilovepin.net',
  'Referer': 'https://ilovepin.net/id'
};

async function pinIlovepin(pinUrl) {
  const mainPage = await axios.get('https://ilovepin.net/id', {
    headers: { 'User-Agent': HEADERS['User-Agent'] }, timeout: 12000
  });
  const rawCookies = mainPage.headers['set-cookie'];
  const cookieString = rawCookies ? rawCookies.join('; ') : '';

  const { data } = await axios.post(
    'https://ilovepin.net/proxy.php',
    qs.stringify({ url: pinUrl }),
    {
      headers: {
        ...HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookieString
      },
      timeout: 20000
    }
  );

  if (!data.api || data.api.status !== 'OK')
    throw new Error('Gagal mengambil data Pinterest');

  const api = data.api;
  const items = api.mediaItems || [];
  const videos = items.filter(i => i.type === 'Video').map(i => ({
    quality: i.quality || 'source', size: i.size || '', url: i.url
  }));
  const images = items.filter(i => i.type === 'Image').map(i => ({
    quality: i.quality || 'original', size: i.size || '', url: i.url
  }));

  return {
    title: api.title || '',
    description: api.description?.trim() || '',
    author: { name: api.userInfo?.name || '', url: api.userInfo?.url || '' },
    thumbnail: api.thumb || images[0]?.url || '',
    type: videos.length ? 'video' : 'image',
    videos, images
  };
}

// Fallback: pinterest direct OG meta scrape
async function pinFallback(pinUrl) {
  const { data: html } = await axios.get(pinUrl, {
    headers: { 'User-Agent': HEADERS['User-Agent'] }, timeout: 15000
  });
  const videoMatch = html.match(/"url":"(https:\/\/v\.pinimg\.com[^"]+\.mp4[^"]*)"/);
  const imageMatch = html.match(/"images":\{"orig":\{"url":"([^"]+)"/);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const videos = videoMatch ? [{ quality: 'source', url: videoMatch[1].replace(/\\u002F/g, '/') }] : [];
  const images = imageMatch ? [{ quality: 'orig', url: imageMatch[1].replace(/\\u002F/g, '/') }] : [];
  return {
    title: titleMatch ? titleMatch[1].replace(' | Pinterest', '').trim() : 'Pinterest Media',
    description: '', author: { name: '' },
    thumbnail: images[0]?.url || '',
    type: videos.length ? 'video' : 'image',
    videos, images
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const url = req.query.url || req.body?.url;
    if (!url) return res.status(400).json({ ok: false, msg: 'URL required' });
    if (!/pinterest\.|pin\.it/i.test(url))
      return res.status(400).json({ ok: false, msg: 'Bukan URL Pinterest valid' });
    let result;
    try { result = await pinIlovepin(url); } catch { result = await pinFallback(url); }
    return res.json({ ok: true, data: result });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};
