// api/youtube.js — ssyoutube.com (ported from OurinMD bot yt.js)
// Fallback: y2mate.nu reverse-engineer (from ytmp4.js)
const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

const SALT = '384d5028ee4a399f6cae0175025a1708aa924fc0ccb08be1aa359cd856dd1639';
const FIXED_TS = '1765962059039';

function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

async function ytSSYoutube(videoUrl) {
  const currentTs = Date.now().toString();
  const rawStr = videoUrl + currentTs + SALT;
  const signature = crypto.createHash('sha256').update(rawStr).digest('hex');
  const payload = { sf_url: videoUrl, ts: currentTs, _ts: FIXED_TS, _tsc: '0', _s: signature };

  const { data } = await axios.post(
    'https://ssyoutube.com/api/convert',
    qs.stringify(payload),
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin': 'https://ssyoutube.com',
        'Referer': 'https://ssyoutube.com/'
      },
      timeout: 25000
    }
  );

  if (!data || !data.url) throw new Error('ssyoutube no data');

  const downloads = Array.isArray(data.url)
    ? data.url.filter(i => !i.no_audio).map(i => ({
        quality: i.quality || i.subname,
        format: i.ext,
        size: formatSize(i.filesize),
        url: i.url,
        isAudio: !!i.audio
      }))
    : [];

  return {
    meta: {
      id: data.id,
      title: data.meta?.title || 'YouTube Video',
      duration: data.meta?.duration || '',
      thumbnail: data.thumb || ''
    },
    downloads
  };
}

// Fallback: thesocialcat.com (from ytdl.js)
async function ytFallback(videoUrl, format = 'video') {
  const { data } = await axios.post(
    'https://thesocialcat.com/api/youtube-download',
    { format: format === 'audio' ? 'audio' : 'video', url: videoUrl },
    {
      headers: {
        'Accept': '*/*', 'Content-Type': 'application/json',
        'Referer': 'https://thesocialcat.com/tools/youtube-video-downloader'
      },
      timeout: 25000
    }
  );
  return { meta: { title: data?.title || 'YouTube Video', thumbnail: data?.thumbnail || '' }, downloads: [data?.results].flat().filter(Boolean) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const url = req.query.url || req.body?.url;
    const format = req.query.format || req.body?.format || 'video';
    if (!url) return res.status(400).json({ ok: false, msg: 'URL required' });
    if (!/youtube\.com|youtu\.be/i.test(url))
      return res.status(400).json({ ok: false, msg: 'Bukan URL YouTube valid' });

    let result;
    try { result = await ytSSYoutube(url); } catch { result = await ytFallback(url, format); }
    return res.json({ ok: true, data: result });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};

