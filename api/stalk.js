// api/stalk.js — TikTok stalk via tikwm.com (ported from OurinMD tiktokstalk.js)
const axios = require('axios');

function fmtNum(n) {
  if (!n) return '0';
  n = parseInt(n);
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return String(n);
}

async function stalkTikTok(username) {
  // Primary: tikwm user info
  const { data } = await axios.get(
    `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(username)}`,
    { timeout: 15000 }
  );
  if (!data || data.code !== 0) throw new Error(data?.msg || 'User tidak ditemukan');
  const u = data.data?.user || data.data;
  const stats = data.data?.stats || {};
  return {
    username: u.uniqueId || username,
    nickname: u.nickname || '',
    bio: u.signature || '',
    avatar: u.avatarLarger || u.avatarMedium || u.avatar || '',
    verified: !!u.verified,
    privateAccount: !!u.privateAccount,
    stats: {
      followers: fmtNum(stats.followerCount || u.followerCount),
      following: fmtNum(stats.followingCount || u.followingCount),
      likes: fmtNum(stats.heartCount || u.heartCount || stats.heart),
      videos: fmtNum(stats.videoCount || u.videoCount)
    }
  };
}

// Fallback: baguss.xyz (same as bot)
async function stalkFallback(username) {
  const { data } = await axios.get(
    `https://api.baguss.xyz/api/stalker/tiktok?username=${encodeURIComponent(username)}`,
    { timeout: 15000 }
  );
  if (!data?.result) throw new Error('User tidak ditemukan');
  const r = data.result;
  return {
    username: r.username || username,
    nickname: r.nickname || '',
    bio: r.bio || '',
    avatar: r.avatar || '',
    verified: !!r.verified,
    privateAccount: !!r.private,
    stats: {
      followers: fmtNum(r.followers),
      following: fmtNum(r.following),
      likes: fmtNum(r.likes),
      videos: fmtNum(r.videos)
    }
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const username = (req.query.username || req.body?.username || '').replace('@', '').trim();
    if (!username) return res.status(400).json({ ok: false, msg: 'Username required' });
    let result;
    try { result = await stalkTikTok(username); } catch { result = await stalkFallback(username); }
    return res.json({ ok: true, data: result });
  } catch (err) { return res.status(500).json({ ok: false, msg: err.message }); }
};
