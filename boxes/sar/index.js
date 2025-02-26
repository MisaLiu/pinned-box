import puppeteer from 'puppeteer-extra';
import PuppeteerStealthPlugin from 'puppeteer-extra-plugin-stealth';
import gistBox from 'gist-box';

const { GistBox } = gistBox;
const {
  SAR_STEAMID,
  GIST_ID,
  GH_TOKEN
} = process.env;

// Add stealth plugin
puppeteer.use(PuppeteerStealthPlugin());

// Init headless browser
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1920, height: 1080 },
});

// Grab content from API
console.log('Getting player stats data from royale.pet...');
const page = await browser.newPage();
page.goto(`https://sar.fisk.cc/api/player/${SAR_STEAMID}/stats`)
  .then(async (response) => {
    let body;
    try {
      body = await response.json();
    } catch (e) {
      console.error('Failed to decode server response');
      console.error(e);
      browser.close().then();
      return;
    }

    const result = {
      level: 0,
      exp: 0,
      expNext: 0,
      expProgress: 0,
      kills: 0,
      deaths: 0,
      damages: 0,
      tapes: 0,
      juice: 0,
      armorBroken: 0,
      playTime: 0,
      playCount: 0,
    };

    console.log('Generating stats data...');

    for (const name in body.stats) {
      const stat = body.stats[name];
      if (name.indexOf('Kills') !== 0 || stat.group === 'Kill Statistics') continue;
      result.kills += stat.value;
    }

    for (const name in body.stats) {
      const stat = body.stats[name];
      if (name.indexOf('Deaths') !== 0) continue;
      result.deaths += stat.value;
    }

    for (const name in body.stats) {
      const stat = body.stats[name];
      if (name.indexOf('Games') !== 0) continue;
      result.playCount += stat.value;
    }

    result.level = (body.stats.AccountLevelNew.value + 1);
    result.exp = body.stats.AccountExpIntoCurrentLevelNew.value;
    result.expNext = body.requiredLevelXp;
    result.expProgress = Math.round((result.exp / result.expNext) * 100);
    result.damages = body.stats.DamageDealt.value;
    result.tapes = body.stats.TapeUsed.value;
    result.juice = body.stats.HealthJuiceDrank.value;
    result.armorBroken = body.stats.EnemyArmorBroken.value;
    result.playTime = body.stats.TimePlayedSeconds.value;
    result.playTimeHours = Math.ceil(result.playTime / 60 / 60);

    const lines = [
      `${'Level'.padStart(14)} 🎮 | Lv.${numberWithCommas(result.level)} ${generateBarChart(result.expProgress, 22)} ${result.expProgress}%`,
      `${'Kill / Death'.padStart(14)} 💀 | ${numberWithCommas(result.kills)} / ${numberWithCommas(result.deaths)} (${Math.round(result.kills / result.deaths * 100) / 100})`,
      `${'Tapes / Juice'.padStart(14)} 🥤 | ${numberWithCommas(result.tapes)} / ${numberWithCommas(result.juice)}`,
      `${'Damage / Armor'.padStart(14)} 🔫 | ${numberWithCommas(result.damages)} / ${numberWithCommas(result.armorBroken)}`,
      `${'Playcount'.padStart(14)} 💾 | ${numberWithCommas(result.playCount)}`,
    ];

    console.log('Updating gist...');
    const box = new GistBox({ id: GIST_ID, token: GH_TOKEN });
    box.update({
      filename: '🔫 小动物吃鸡',
      content: lines.join('\n'),
    }).then(() => {
      console.log('Gist updated!');
    }).catch((e) => {
      console.error('Failed to update gist');
      console.error(e);
    });

    browser.close().then();
  })
  .catch((e) => {
    console.error('Something wrong when processing data');
    console.error(e);
    browser.close().then();
  });

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Copied from https://github.com/matchai/waka-box
 */
function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█"

  const frac = Math.floor((size * 8 * percent) / 100)
  const barsFull = Math.floor(frac / 8)
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size)
  }
  const semi = frac % 8

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1))
}