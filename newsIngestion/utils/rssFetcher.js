/**
 * USIS News v2.0 - RSS Feed Fetcher
 * 
 * Lightweight RSS/Atom parser for news feeds
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');

/**
 * Fetch and parse RSS/Atom feed
 * @param {string} feedUrl - RSS feed URL
 * @param {Object} options
 * @returns {Promise<Array>} Array of feed items
 */
async function fetchRSSFeed(feedUrl, options = {}) {
  const {
    timeout = 10000,
    userAgent = 'USIS-Brain/6.0 (Financial Research Bot)'
  } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseRSSXML(xml);

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`RSS fetch timeout after ${timeout}ms: ${feedUrl}`);
    }
    throw error;
  }
}

/**
 * Parse RSS/Atom XML into normalized items
 */
function parseRSSXML(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  // Try RSS 2.0 format
  $('item').each((i, elem) => {
    items.push(parseRSSItem($, elem));
  });

  // Try Atom format
  if (items.length === 0) {
    $('entry').each((i, elem) => {
      items.push(parseAtomEntry($, elem));
    });
  }

  return items;
}

/**
 * Parse RSS 2.0 <item>
 */
function parseRSSItem($, item) {
  const $item = $(item);
  
  return {
    title: $item.find('title').text().trim(),
    link: $item.find('link').text().trim() || $item.find('guid').text().trim(),
    description: $item.find('description').text().trim(),
    pubDate: $item.find('pubDate').text().trim(),
    guid: $item.find('guid').text().trim(),
    category: $item.find('category').map((i, el) => $(el).text()).get(),
    content: $item.find('content\\:encoded, encoded').text().trim() // RSS content:encoded
  };
}

/**
 * Parse Atom <entry>
 */
function parseAtomEntry($, entry) {
  const $entry = $(entry);
  const link = $entry.find('link[rel="alternate"]').attr('href') || 
               $entry.find('link').first().attr('href');

  return {
    title: $entry.find('title').text().trim(),
    link: link,
    description: $entry.find('summary').text().trim(),
    pubDate: $entry.find('published').text().trim() || $entry.find('updated').text().trim(),
    guid: $entry.find('id').text().trim(),
    category: $entry.find('category').map((i, el) => $(el).attr('term')).get(),
    content: $entry.find('content').text().trim()
  };
}

/**
 * Extract text from HTML content
 */
function stripHtml(html) {
  const $ = cheerio.load(html);
  return $.text().trim();
}

module.exports = {
  fetchRSSFeed,
  stripHtml
};
