require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Octokit } = require('@octokit/rest');
const { login_status, login_refresh, user_record } = require('NeteaseCloudMusicApi');

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  USER_ID: userId,
  USER_TOKEN,
} = process.env;

(async () => {
  let userToken = `MUSIC_U=${USER_TOKEN}`;

  /**
   * Get cached user token
   */
  const userTokenCachedPath = path.join(__dirname, 'USER_TOKEN');
  if (fs.existsSync(userTokenCachedPath)) {
    userToken = fs.readFileSync(userTokenCachedPath, { encoding: 'utf8' });
  }

  /**
   * Get user login status
   */
  console.log('Check login status...');
  const loginStatus = await login_status({
    cookie: userToken
  }).catch(error => {
    console.error('Cannot get user login status');
    console.error({ ...error, cookie: [ '...' ] });
  });

  if (loginStatus) {
    console.log(`Logged in as ${loginStatus.body.profile.nickname}`);
  }

  /**
   * Refresh user token
   */
  console.log('Refreshing user token...');
  const newUserToken = await login_refresh({
    cookie: userToken,
  }).catch(error => {
    console.warn('Cannot refresh user token, skipping');
    console.warn({ ...error, cookie: [ '...' ] });
  });

  if (!!newUserToken && !!getCookieByName('MUSIC_U', newUserToken.cookie)) {
    userToken = getCookieByName('MUSIC_U', newUserToken.cookie);
    fs.writeFileSync(userTokenCachedPath, userToken, { encoding: 'utf8' });
  }

  /**
   * First, get user record
   */
  const record = await user_record({
    cookie: userToken,
    uid: userId,
    type: 1, // last week
  }).catch(error => {
    console.error('Cannot get user records');
    console.error({ ...error, cookie: [ '...' ] });
  });

  /**
   * Second, get week play data and parse into song/plays diagram
   */

  let totalPlayCount = 0;
  const { weekData } = record.body;
  weekData.forEach(data => {
    totalPlayCount += data.playCount;
  });

  const icon = ['🥇', '🥈', '🥉', '', '']

  const lines = weekData.slice(0, 5).reduce((prev, cur, index) => {
    const playCount = cur.playCount;
    const artists = cur.song.ar.map(a => a.name);
    let name = `${cur.song.name} - ${artists.join('/')}`;

    const line = [
      icon[index].padEnd(2),
      name,
      ' · ',
      `${playCount}`,
      'plays',
    ];

    return [...prev, line.join(' ')];
  }, []);

  /**
   * Finally, write into gist
   */

  try {
    const octokit = new Octokit({
      auth: `token ${githubToken}`,
    });
    const gist = await octokit.gists.get({
      gist_id: gistId,
    });

    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `🎵 听的歌`,
          content: lines.join('\n'),
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }
})();

function getCookieByName(name, cookies) {
  for (const cookie of cookies) {
    const cookieSplit = cookie.split(/;\s/)[0].split('=');
    const cookieName = cookieSplit[0];
    const cookieValue = [ ...cookieSplit.slice(1) ].join('=');

    if (cookieName == name) return `${cookieName}=${cookieValue}`;
  }
  return null;
}