// This script is executed by GitHub Actions to:
// 1) Get a Port access token
// 2) Fetch data from YouTube (later)
// 3) Build Port entities
// 4) Upsert them into Port

async function getPortAccessToken() {
  const clientId = process.env.PORT_CLIENT_ID;
  const clientSecret = process.env.PORT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing PORT_CLIENT_ID or PORT_CLIENT_SECRET environment variables');
  }

  const url = 'https://api.port.io/v1/auth/access_token';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Port auth failed: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = await response.json();
  if (!data.accessToken) {
    throw new Error('No accessToken in Port response');
  }

  return data.accessToken;
}

async function fetchYoutubePlaylistAndVideos(playlistId) {
  // TODO: implement later
  return {
    playlist: null,
    videos: [],
  };
}

function buildPortEntities(youtubeData) {
  // TODO: implement later
  return {
    playlistEntity: null,
    videoEntities: [],
  };
}

async function upsertEntityToPort(accessToken, blueprintId, entity) {
  // TODO: implement later
}

async function main() {
  console.log('Starting ingest script...');

  const playlistId = process.env.PLAYLIST_ID;
  if (!playlistId) {
    throw new Error('Missing PLAYLIST_ID environment variable');
  }

  const accessToken = await getPortAccessToken();
  console.log('Got Port access token (length):', accessToken.length);

  // The rest will be implemented in next steps:
  // 1) fetch YouTube data
  // 2) build Port entities
  // 3) upsert entities into Port

  console.log('Ingest script finished (skeleton).');
}

main().catch((err) => {
  console.error('Ingest script failed:', err);
  process.exit(1);
});
