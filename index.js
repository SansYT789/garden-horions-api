const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const USER_TOKEN = process.env.USER_TOKEN;
const CHANNEL_IDS = {
  seed:    process.env.SEED_CHANNEL_ID,
  gear:    process.env.GEAR_CHANNEL_ID,
  weather: process.env.WEATHER_CHANNEL_ID
};

const HEADERS = {
  'Authorization': USER_TOKEN,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0'
};

// Cache role names
const roleCache = {};

async function fetchRoleName(guildId, roleId) {
  const key = `${guildId}_${roleId}`;
  if (roleCache[key]) return roleCache[key];
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers: HEADERS });
    const roles = await res.json();
    for (const role of roles) roleCache[`${guildId}_${role.id}`] = role.name;
    return roleCache[key] || roleId;
  } catch { return roleId; }
}

async function resolveRoles(text, guildId) {
  const matches = [...new Set(text.match(/<@&(\d+)>/g) || [])];
  let result = text;
  for (const match of matches) {
    const roleId = match.slice(3, -1);
    const name = await fetchRoleName(guildId, roleId);
    result = result.replaceAll(match, `**${name}**`);
  }
  return result;
}

function cleanText(text) {
  return text.split('\n').filter(l => !l.startsWith('-#')).join('\n').trim();
}

async function fetchLatest(channelName) {
  const channelId = CHANNEL_IDS[channelName];
  if (!channelId) return null;
  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=10`,
      { headers: HEADERS }
    );
    if (!res.ok) { console.error(`Discord API error ${res.status} on ${channelName}`); return null; }

    const messages = await res.json();
    const botMsg = messages.find(m => m.author.bot);
    if (!botMsg) return null;

    const guildId = botMsg.guild_id;
    let content = botMsg.content || '';
    if (guildId) content = await resolveRoles(content, guildId);
    content = cleanText(content);

    const tsMatches = botMsg.content.match(/<t:(\d+):[RFf]>/g) || [];
    const timestamps = tsMatches.map(t => new Date(parseInt(t.match(/<t:(\d+):/)[1]) * 1000).toISOString());

    const itemLines = content.split('\n').filter(l => l.startsWith('- **'));
    const items = itemLines.map(line => {
      const m = line.match(/- \*\*(.+?)\*\* \(x(\d+)\)/);
      return m ? { name: m[1], qty: parseInt(m[2]) } : { name: line.replace('- ', ''), qty: null };
    });

    let weather = null;
    if (channelName === 'weather') {
      const nameMatch = content.match(/It's now \*\*(.+?)\*\*/);
      const effectLine = content.split('\n').find(l => l.startsWith('**Take') || l.startsWith('**'));
      weather = {
        type: nameMatch ? nameMatch[1] : 'Unknown',
        effect: effectLine ? effectLine.replace(/\*\*/g, '') : '',
        startTime: timestamps[0] || null,
        endTime: timestamps[1] || null,
      };
    }

    return {
      channel: channelName,
      messageId: botMsg.id,
      postedAt: botMsg.timestamp,
      updatedAt: timestamps[timestamps.length - 1] || botMsg.timestamp,
      content,
      items: items.length ? items : undefined,
      weather: weather || undefined,
    };
  } catch (err) { console.error(`Lỗi ${channelName}:`, err.message); return null; }
}

let cache = { seed: null, gear: null, weather: null, lastRefresh: null };

async function refreshCache() {
  const [seed, gear, weather] = await Promise.all([
    fetchLatest('seed'), fetchLatest('gear'), fetchLatest('weather')
  ]);
  cache = { seed, gear, weather, lastRefresh: new Date().toISOString() };
  console.log('Refreshed:', new Date().toLocaleTimeString());
}

app.get('/', (req, res) => res.json({ status: 'online', lastRefresh: cache.lastRefresh }));
app.get('/api/all', (req, res) => res.json({ success: true, ...cache }));
app.get('/api/:channel', (req, res) => {
  const { channel } = req.params;
  if (!['seed','gear','weather'].includes(channel))
    return res.status(404).json({ success: false, message: 'Dùng: seed | gear | weather' });
  res.json({ success: true, data: cache[channel] });
});
app.get('/refresh', async (req, res) => {
  await refreshCache();
  res.json({ success: true, lastRefresh: cache.lastRefresh });
});

const PORT = process.env.PORT || 3000;
(async () => {
  await refreshCache();
  setInterval(refreshCache, 30000);
  app.listen(PORT, () => console.log(`API chạy tại port ${PORT}`));
})();