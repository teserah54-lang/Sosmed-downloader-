// api/search.js — TikTok: tikwm.com | YouTube: invidious multi-instance
const axios = require('axios');

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.io.lol',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com'
];

function fmtNum(n) {
  if (!n) return '0';
  n = parseInt(n);
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

function fmtDur(s) {
  if (!s) return '';
  s = parseInt(s);
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

async function searchTikTok(query, cursor = 0) {
  const { data } = await axios.get(
    `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=6&cursor=${cursor}&hd=1`,
    { timeout: 15000 }
  );
  if (!data || data.code !== 0) throw new Error(data?.msg || 'TikTok search gagal');
  return (data.data?.videos || []).map(v => ({
    id: v.video_id || v.id,
    title: v.title || 'TikTok Video',
    author: v.author?.nickname || '',
    cover: v.cover || v.origin_cover || '',
    duration: fmtDur(v.duration),
    views: fmtNum(v.play_count),
    likes: fmtNum(v.digg_count),
    dlUrl: v.play || '',
    hdUrl: v.hdplay || v.play || '',
    audioUrl: v.music || '',
    platform: 'tiktok'
  }));
}

async function searchYouTube(query, page = 1) {
  let lastErr = '';
  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const { data } = await axios.get(
        `${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video&page=${page}`,
        { timeout: 10000 }
      );
      if (!Array.isArray(data) || !data.length) continue;
      return data.slice(0, 6).map(v => ({
        id: v.videoId,
        title: v.title || 'YouTube Video',
        author: v.author || '',
        cover: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
        duration: fmtDur(v.lengthSeconds),
        views: fmtNum(v.viewCount),
        likes: '',
        ytUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        platform: 'youtube'
      }));
    } catch (e) { lastErr = e.message; continue; }
  }
  throw new Error('Semua instance YouTube timeout: ' + lastErr);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const q = req.query.q || req.body?.q;
    const platform = req.query.platform || req.body?.platform || 'tiktok';
    const cursor = parseInt(req.query.cursor || req.body?.cursor || '0');
    const page = parseInt(req.query.page || req.body?.page || '1');

    if (!q) return res.status(400).json({ ok: false, msg: 'Query required' });

    let results;
    if (platform === 'youtube') results = await searchYouTube(q, page);
    else results = await searchTikTok(q, cursor);

    return res.json({ ok: true, platform, query: q, count: results.length, data: results });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};

