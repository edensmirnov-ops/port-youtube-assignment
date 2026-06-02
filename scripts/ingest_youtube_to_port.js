// scripts/ingest_youtube_to_port.js
// Usage: executed in GitHub Actions with env:
// PLAYLIST_ID, YOUTUBE_API_KEY, PORT_CLIENT_ID, PORT_CLIENT_SECRET
// Run with: node --experimental-fetch scripts/ingest_youtube_to_port.js

async function getPortAccessToken() {
  const clientId = process.env.PORT_CLIENT_ID;
  const clientSecret = process.env.PORT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PORT_CLIENT_ID or PORT_CLIENT_SECRET environment variables');
  }

  const url = 'https://api.port.io/v1/auth/access_token';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Port auth failed: ' + response.status + ' ' + response.statusText + ' - ' + text);
  }

  const data = await response.json();
  if (!data.accessToken) throw new Error('No accessToken in Port response');
  return data.accessToken;
}

async function fetchYoutubePlaylistAndVideos(playlistId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('Missing YOUTUBE_API_KEY environment variable');

  // Get playlist details
  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlists');
  playlistUrl.searchParams.set('part', 'snippet,contentDetails');
  playlistUrl.searchParams.set('id', playlistId);
  playlistUrl.searchParams.set('key', apiKey);

  const playlistRes = await fetch(playlistUrl);
  if (!playlistRes.ok) {
    const text = await playlistRes.text();
    throw new Error(YouTube playlist fetch failed: ${playlistRes.status} ${playlistRes.statusText} - ${text});
  }
  const playlistData = await playlistRes.json();
  const playlistItem = playlistData.items && playlistData.items[0];
  if (!playlistItem) throw new Error(No playlist found for id ${playlistId});

  const playlist = {
    id: playlistItem.id,
    title: playlistItem.snippet.title,
    description: playlistItem.snippet.description,
    publishedAt: playlistItem.snippet.publishedAt,
    thumbnail:
      (playlistItem.snippet.thumbnails && (playlistItem.snippet.thumbnails.high?.url || playlistItem.snippet.thumbnails.default?.url)) || null,
  };
// Get all playlistItems -> videoIds, paginated
  let videos = [];
  let nextPageToken = undefined;

  do {
    const itemsUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    itemsUrl.searchParams.set('part', 'contentDetails');
    itemsUrl.searchParams.set('playlistId', playlistId);
    itemsUrl.searchParams.set('maxResults', '50');
    itemsUrl.searchParams.set('key', apiKey);
    if (nextPageToken) itemsUrl.searchParams.set('pageToken', nextPageToken);
const itemsRes = await fetch(itemsUrl);
if (!itemsRes.ok) {
  const text = await itemsRes.text();
  throw new Error(`YouTube playlistItems fetch failed: ${itemsRes.status} ${itemsRes.statusText} - ${text}`);
}
const itemsData = await itemsRes.json();

const batchVideoIds = (itemsData.items || [])
  .map(it => it.contentDetails && it.contentDetails.videoId)
  .filter(Boolean);

if (batchVideoIds.length > 0) {
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
  videosUrl.searchParams.set('id', batchVideoIds.join(','));
  videosUrl.searchParams.set('key', apiKey);

  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) {
    const text = await videosRes.text();
    throw new Error(`YouTube videos fetch failed: ${videosRes.status} ${videosRes.statusText} - ${text}`);
  }
  const videosData = await videosRes.json();

  const batchVideos = (videosData.items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails.duration,
    views: Number(v.statistics?.viewCount || 0),
    likes: Number(v.statistics?.likeCount || 0),
    commentsCount: Number(v.statistics?.commentCount || 0),
    thumbnail: (v.snippet.thumbnails && (v.snippet.thumbnails.high?.url || v.snippet.thumbnails.default?.url)) || null,
  }));

  videos = videos.concat(batchVideos);
}

nextPageToken = itemsData.nextPageToken;
  } while (nextPageToken);

  return { playlist, videos };
}
// buildPortEntities
function buildPortEntities(youtubeData) {
  const playlist = youtubeData.playlist;
  const videos = youtubeData.videos || [];

  const playlistId = playlist.id || playlist-${Date.now()};

  const playlistEntity = {
    identifier: playlistId,
    title: playlist.title || playlistId,
    properties: {
      id: playlistId,
      title: playlist.title || '',
      description: playlist.description || '',
      publishedAt: playlist.publishedAt || null,
      thumbnail: playlist.thumbnail || null,
      totalVideos: videos.length,
    },
  };

  const videoEntities = videos.map((v) => ({
    identifier: v.id,
    title: v.title || v.id,
    properties: {
      id: v.id,
      title: v.title || '',
      description: v.description || '',
      publishedAt: v.publishedAt || null,
      duration: v.duration || null,
      views: v.views || 0,
      likes: v.likes || 0,
      commentsCount: v.commentsCount || 0,
      thumbnail: v.thumbnail || null,
      url: https://youtu.be/${v.id},
    },
    relations: {
      playlist: [playlistId],
    },
  }));

  return { playlistEntity, videoEntities };
}

// upsertEntityToPort
async function upsertEntityToPort(accessToken, blueprintId, entity) {
  const url = https://api.port.io/v1/blueprints/${encodeURIComponent(blueprintId)}/entities?upsert=true;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': Bearer ${accessToken},
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(entity),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(Port upsert failed (${blueprintId}): ${res.status} ${res.statusText} - ${t});
  }
  return await res.json();
}
async function main() {
  console.log('Starting ingest script...');

  const playlistId = process.env.PLAYLIST_ID;
  if (!playlistId) throw new Error('Missing PLAYLIST_ID environment variable');

  const accessToken = await getPortAccessToken();
  console.log('Got Port access token (length):', accessToken.length);

  console.log('Fetching YouTube playlist and videos...');
  const youtubeData = await fetchYoutubePlaylistAndVideos(playlistId);
  console.log('YouTube playlist title:', youtubeData.playlist.title);
  console.log('YouTube videos count:', youtubeData.videos.length);

  console.log('Building Port entities...');
  const { playlistEntity, videoEntities } = buildPortEntities(youtubeData);

  console.log('Upserting playlist to Port:', playlistEntity.identifier);
  await upsertEntityToPort(accessToken, 'playlist', playlistEntity);
  console.log('Playlist upserted.');

  console.log('Upserting videos to Port (will iterate):');
  for (const v of videoEntities) {
    console.log(' Upserting video', v.identifier);
    await upsertEntityToPort(accessToken, 'video', v);
  }
  console.log('All videos upserted.');

  console.log('Ingest script finished.');
}

main().catch((err) => {
  console.error('Ingest script failed:', err);
  process.exit(1);
});
