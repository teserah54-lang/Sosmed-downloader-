// api/instagram.js — reelsvideo.io scraper (ported from OurinMD bot)
const axios = require('axios');
const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');

function generateTS() { return Math.floor(Date.now() / 1000); }
function generateTT(ts) { return CryptoJS.MD5(ts + 'X-Fc-Pp-Ty-eZ').toString(); }

async function igReelsvideo(url) {
  const ts = generateTS(), tt = generateTT(ts);
  const body = new URLSearchParams();
  body.append('id', url); body.append('locale', 'en');
  body.append('cf-turnstile-response', ''); body.append('tt', tt); body.append('ts', ts);

  const { data: html } = await axios.post(
    'https://reelsvideo.io/',
    body,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*', 'hx-request': 'true',
        'hx-current-url': 'https://reelsvideo.io/',
        'hx-target': 'target',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://reelsvideo.io', 'Referer': 'https://reelsvideo.io/'
      },
      timeout: 25000
    }
  );

  const $ = cheerio.load(html);
  const username = $('.bg-white span.text-400-16-18').first().text().trim() || null;
  const thumb = $('div[data-bg]').first().attr('data-bg') || null;
  const videos = [], images = [], mp3 = [];

  $('a.type_videos').each((_, el) => { const h = $(el).attr('href'); if (h) videos.push(h); });
  $('a.type_images').each((_, el) => { const h = $(el).attr('href'); if (h) images.push(h); });
  $('a.type_audio').each((_, el) => { const h = $(el).attr('href'); if (h) mp3.push(h); });

  const type = videos.length ? 'video' : images.length ? 'image' : 'unknown';
  return { username, thumb, type, videos, images, mp3 };
}

// Fallback: saveig.app
async function igFallback(url) {
  const { data } = await axios.post(
    'https://saveig.app/api/ajaxSearch',
    new URLSearchParams({ q: url, t: 'media', lang: 'en' }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Origin': 'https://saveig.app', 'Referer': 'https://saveig.app/'
      },
      timeout: 20000
    }
  );
  const $ = cheerio.load(data?.data || '');
  const videos = [], images = [];
  $('a[href*=".mp4"]').each((_, el) => { const h = $(el).attr('href'); if (h) videos.push(h); });
  $('a[href*=".jpg"], a[href*=".jpeg"], a[href*=".webp"]').each((_, el) => { const h = $(el).attr('href'); if (h) images.push(h); });
  const thumb = $('img.preview-image').first().attr('src') || null;
  const type = videos.length ? 'video' : images.length ? 'image' : 'unknown';
  return { username: null, thumb, type, videos, images, mp3: [] };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const url = req.query.url || req.body?.url;
    if (!url) return res.status(400).json({ ok: false, msg: 'URL required' });
    if (!/instagram\.com/i.test(url))
      return res.status(400).json({ ok: false, msg: 'Bukan URL Instagram valid' });
    let result;
    try { result = await igReelsvideo(url); } catch { result = await igFallback(url); }
    return res.json({ ok: true, data: result });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};
