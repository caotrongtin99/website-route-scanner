const queryString =  require('query-string');
const request = require('request');
const cheerio = require('cheerio');

function collectInternalLinks($, domain) {
  return new Promise(resolve => {
    const foundPages = [];
    const elements =
      `a[href^='http://${domain}']:not(a[href^='mailto']), ` +
      `a[href^='https://${domain}']:not(a[href^='mailto']), ` +
      `a[href^='https://www.${domain}']:not(a[href^='mailto']), ` +
      `a[href^='http://www.${domain}']:not(a[href^='mailto']), ` +
      `a[href$='.asp']:not(a[href^='mailto']), ` +
      `a[href$='.php']:not(a[href^='mailto']), ` +
      `a[href^='/']:not(a[href^='mailto'])`;

    const relativeLinks = $(elements);

    relativeLinks.each(function() {
      let href = $(this).attr('href');
      if (href && href.indexOf('www.') !== -1) {
        href = href.substr(href.indexOf('www.') + 4, href.length);
      }
      if (href && href.indexOf('http') === 0) {
        href = href.substr(href.indexOf('://') + 3, href.length);
      } else if (href === '/') {
        href = domain;
      } else if (href && href.indexOf('/') === 0) {
        const mainDomain = domain.includes('/') ? domain.substr(0, domain.indexOf('/')) : domain;
        href = mainDomain + href;
      } else {
        const mainDomain = domain.includes('/') ? domain.substr(0, domain.indexOf('/')) : domain;
        href = `${mainDomain}/${href}`;
      }

      if (foundPages.indexOf(href) === -1) {
        foundPages.push(href);
      }
    });
    resolve(foundPages);
  });
}

async function scanWebsiteURLS(domain) {
  domain = domain.replace('https://', '');
  domain = domain.replace('http://', '');
  let urlsToScan = [domain];
  let data = [];
  let index = 0;
  while (data.length < 300 && urlsToScan[index]) {
    try {
      const newUrls = await scanURLsOnPage(urlsToScan[index]);
      index++;
      urlsToScan = [...new Set([...urlsToScan, ...newUrls])].filter(item => item !== `${domain}/`);
      urlsToScan = urlsToScan.map(url =>
        url.slice(-1) === '/' ? url.substr(0, url.length - 1) : url,
      );
      data = [...new Set([...data, ...newUrls])];
    } catch (error) {
      console.log({ error });
    }
  }
  return data;
}

function scanURLsOnPage(url) {
  return new Promise(resolve => {
    request(`https://${url}`, (error, response, body) => {
      if (error) {
        return request(`http://${url}`, (error, response, body) => {
          if (error) {
            resolve([url]);
            return;
          }

          if (!response || response.statusCode !== 200) {
            resolve([]);
            return;
          }
          const $ = cheerio.load(body);
          collectInternalLinks($, url).then(newFoundPages => {
            resolve(newFoundPages);
          });
        });
      }

      if (!response || response.statusCode !== 200) {
        resolve([]);
        return;
      }
      const $ = cheerio.load(body);
      collectInternalLinks($, url).then(newFoundPages => {
        resolve(newFoundPages);
      });
    });
  });
}

module.exports = scanWebsiteURLS
