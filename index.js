const url = require('url')
const qs = require('querystring')
const aimer = require('aimer')
const { send } = require('micro')

const cache = require('lru-cache')({
  max: 1024 * 1024,
  maxAge: 86400 * 30,
})

function ghPinnedRepos(username) {
  return aimer(`https://github.com/${username}`).then(async ($) => {
    const pinned = $('.pinned-item-list-item.public')

    // if empty
    if (!pinned || pinned.length === 0) return []

    const result = []
    for (const [index, item] of Object.entries(pinned)) {
      if (!isNaN(index)) {
        const owner = getOwner($, item)
        const repo = getRepo($, item)
        const link = 'https://github.com/' + (owner || username) + '/' + repo
        const description = getDescription($, item)
        const image = await getImage(link)
        const website = await getWebsite(link)
        const language = getLanguage($, item)
        const languageColor = getLanguageColor($, item)
        const stars = getStars($, item)
        const forks = getForks($, item)

        result[index] = {
          owner: owner || username,
          repo,
          link,
          description: description || undefined,
          image: image || undefined,
          website: website || undefined,
          language: language || undefined,
          languageColor: languageColor || undefined,
          stars: stars || 0,
          forks: forks || 0,
        }
      }
    }
    // });
    return result
  })
}

function getOwner($, item) {
  try {
    return $(item).find('.owner').text()
  } catch (error) {
    return undefined
  }
}

function getRepo($, item) {
  try {
    return $(item).find('.repo').text()
  } catch (error) {
    return undefined
  }
}

function getDescription($, item) {
  try {
    return $(item).find('.pinned-item-desc').text().trim()
  } catch (error) {
    return undefined
  }
}

function getWebsite(repo) {
  return aimer(repo)
    .then(($) => {
      try {
        const site = $('.BorderGrid-cell')
        if (!site || site.length === 0) return []

        let href
        site.each((index, item) => {
          if (index == 0) {
            href = getHREF($, item)
          }
        })
        return href
      } catch (error) {
        console.error(error)
        return undefined
      }
    })
    .catch((error) => {
      console.error(error)
      return undefined
    })
}

function getHREF($, item) {
  try {
    return $(item).find('a[href^="https"]').attr('href').trim()
  } catch (error) {
    return undefined
  }
}

function getImage(repo) {
  return aimer(repo)
    .then(($) => {
      try {
        const site = $('meta')
        if (!site || site.length === 0) return []

        let href
        site.each((index, item) => {
          const attr = $(item).attr('property')
          if (attr == 'og:image') {
            href = getSRC($, item)
          }
        })
        return href
      } catch (error) {
        console.error(error)
        return undefined
      }
    })
    .catch((error) => {
      console.error(error)
      return undefined
    })
}

function getSRC($, item) {
  try {
    return $(item).attr('content').trim()
  } catch (error) {
    return undefined
  }
}

function getStars($, item) {
  try {
    return $(item).find('a[href$="/stargazers"]').text().trim()
  } catch (error) {
    return 0
  }
}

function getForks($, item) {
  try {
    return $(item).find('a[href$="/network/members"]').text().trim()
  } catch (error) {
    return 0
  }
}

function getLanguage($, item) {
  try {
    return $(item).find('[itemprop="programmingLanguage"]').text()
  } catch (error) {
    return undefined
  }
}

function getLanguageColor($, item) {
  try {
    return $(item).find('.repo-language-color').css('background-color')
  } catch (error) {
    return undefined
  }
}

module.exports = async function (req, res) {
  /* allow cors from any origin */
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Request-Method', '*')
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    return send(res, 200)
  }

  const { query } = url.parse(req.url)
  const { username, refresh } = qs.parse(query)

  if (!username) {
    res.setHeader('Content-Type', 'text/html')
    return send(
      res,
      200,
      `
  <head>
    <meta charset="utf-8" />
    <title>GitHub pinned repos API</title>
  </head>
  <style>body {font-family: Helvetica, serif;margin: 30px;}</style>
  <p>GET /?username=GITHUB_USERNAME</p>

  <p>
    <form action="/">
      <input type="text" name="username" placeholder="username" />
      <button type="submit">Go!</button>
    </form>
  </p>

  <p>made by <a href="https://github.com/egoist">@egoist</a> ?? <a href="https://github.com/egoist/gh-pinned-repos">source code</a></p>
`,
    )
  }

  let result
  const cachedResult = cache.get(username)
  if (cachedResult && !refresh) {
    result = cachedResult
  } else {
    result = await ghPinnedRepos(username)
    cache.set(username, JSON.stringify(result))
  }
  send(res, 200, result)
}
