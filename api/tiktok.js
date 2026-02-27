// api/tiktok.js — musicaldown.com scraper (ported from OurinMD bot)
// Fallback: tikwm.com
const axios = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';

async function ttdown(url) {
  const { data: html, headers } = await axios.get('https://musicaldown.com/en', {
    headers: { 'User-Agent': UA }, timeout: 15000
  });
  const $ = cheerio.load(html);
  const payload = {};
  $('#submit-form input').each((_, el) => {
    const name = $(el).attr('name'), value = $(el).attr('value');
    if (name) payload[name] = value || '';
  });
  const urlField = Object.keys(payload).find(k => !payload[k]);
  if (urlField) payload[urlField] = url;

  const { data } = await axios.post('https://musicaldown.com/download',
    new URLSearchParams(payload).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': headers['set-cookie']?.join('; ') || '',
      'Origin': 'https://musicaldown.com', 'Referer': 'https://musicaldown.com/',
      'User-Agent': UA
    }, timeout: 20000
  });

  const $$ = cheerio.load(data);
  const bgImage = $$('.video-header').attr('style') || '';
  const coverMatch = bgImage.match(/url\((.*?)\)/);
  const downloads = [];
  $$('a.download').each((_, el) => {
    const $el = $$(el);
    const type = $el.data('event')?.replace('_download_click', '') || 'video';
    downloads.push({ type, label: $el.text().trim(), url: $el.attr('href') });
  });
  return {
    title: $$('.video-desc').text().trim() || 'TikTok Video',
    author: { username: $$('.video-author b').text().trim(), avatar: $$('.img-area img').attr('src') },
    cover: coverMatch ? coverMatch[1] : null, downloads
  };
}

async function ttdownFallback(url) {
  const { data } = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, { timeout: 15000 });
  if (!data || data.code !== 0) throw new Error(data?.msg || 'tikwm gagal');
  const d = data.data;
  return {
    title: d.title || 'TikTok Video',
    author: { username: d.author?.nickname || '', avatar: d.author?.avatar || '' },
    cover: d.cover || d.origin_cover || null,
    downloads: [
      { type: 'hd', label: 'HD No Watermark', url: d.hdplay || d.play },
      { type: 'video', label: 'SD No Watermark', url: d.play },
      { type: 'mp3', label: 'Audio MP3', url: d.music }
    ].filter(x => x.url)
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const url = req.query.url || req.body?.url;
    if (!url) return res.status(400).json({ ok: false, msg: 'URL required' });
    if (!/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(url))
      return res.status(400).json({ ok: false, msg: 'Bukan URL TikTok valid' });
    let result;
    try { result = await ttdown(url); } catch { result = await ttdownFallback(url); }
    return res.json({ ok: true, data: result });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};
