const fs = require('fs')
const path = require('path')
const { send, json } = require('micro')
const { router, get, post }  = require('microrouter')
const authSlack = require('microauth-slack')
const rateLimit = require('micro-ratelimit')
const handlebars = require('handlebars')
const toPromise = require('denodeify')
const { parse } = require('url')
const mime = require('mime')

/**
 * TODO:
 * - Add mongo storage
 *   - store teams / bot token
 *   - persist reminder id
 * - deleteReminder
 * - add onboarding message to user
 * - update index page to use simple html/css
 * - update call back page with simple html/css
 */

const {
  slack: {
    clientId,
    clientSecret,
    verificationToken,
    token,
    reaction,
    scope,
    callbackUrl
  },
  common
} = require('./config')

const { to } = require('./utils')
const Slack = require('./lib/slack')

const options = {
  clientId,
  clientSecret,
  callbackUrl,
  scope,
  path: '/auth/path'
}

const slackAuth = authSlack(options)
const auth = async (req, res, auth) => {
  if(!auth) return send(res, 404, 'Not Found')
  if (auth.err) return send(res, 403, new Error(auth.err))
  return send(res, 200, '<p>Snoozebot was successfully installed on your team.</p>')
}

const events = async (req, res) => {
  try {
    const [err, payload] = await to(json(req))
    if (err) throw new Error(err)
    if (payload && verificationToken !== payload.token) throw new Error(`unauthorized`)
    const { type, event } = payload
    if (type === 'url_verification') return send(res, 200, JSON.stringify(payload))
    if (type !== 'event_callback' || event.reaction !== reaction) return send(res, 200)
    if (!event.item_user) return send(res, 200)
    if (event.type === 'reaction_added') {
      const slack = new Slack(token, { event })
      slack.channel = event.item.channel
      slack.event = event.item.channel
      const reminder = await slack.addReminder()
      const message = await slack.whisper({ ...reminder, event })
    }
    return send(res, 200)
  } catch(err) {
    console.log(err)
    return send(res, 500, err)
  }
}

let cachedView = null
const getView = async () => {
  if (!cachedView) {
    try {
      const file = await toPromise(fs.readFile)(
        path.resolve(__dirname, './views/index.hbs'),
        'utf8'
      )
      cachedView = handlebars.compile(file)
    } catch(err) {
      console.log(err)
      throw new Error(err)
    }
  }
  return cachedView
}

let assets = {}
const getAsset = async (assetPath) => {
  if (!assets[assetPath]) {
    try {
      const file = await toPromise(fs.readFile)(
        path.resolve(__dirname, './static', assetPath),
        'utf8'
      )
      assets[assetPath] = file
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
  }
  return assets[assetPath]
}

const renderView = async (directory) => {
  const data = {
    assetsDir: '/static'
  }
  const view = await getView()
  return view(data)
}

const renderImage = async (file) => {
  try {
    const content = await toPromise(fs.readFile)(path.resolve(process.cwd(), file))
    return {
      content,
      mime: mime.getType(file)
    }
  } catch (err) {
    console.log(err)
    throw new Error(err)
  }
}

const clientView = async (req, res) => {
  const renderedView = await renderView()
  return send(res, 200, renderedView)
}

const validExtensions = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.ico'
])

const exists = async (filePath) => {
  try {
    await toPromise(fs.stat)(filePath)
    return true
  } catch (err) {
    return false
  }
}

const catchAll = async (req, res) => {
  const { pathname } = parse(req.url)
  const pathObj = path.parse(path.join(process.cwd(), pathname))
  if (pathname.startsWith('/static/')) {
    const asset = await getAsset(pathname.replace('/static/', ''))
    res.setHeader('Content-Type', `${mime.getType(pathname)}; charset=utf-8`)
    return send(res, 200, asset)
  }

  if (!awaits(reqPath)) {
    return send(res, 404, 'Not found')
  }

  if (pathObj.ext === '') {
    return send(res, 200)
  } else if (validExtensions.has(pathObj.ext)) {
    try {
      const image = await renderImage(reqPath)
      res.setHeader('Content-Type', `${image.mime}; charset=utf-8`)
      return send(res, 200, image.content)
    } catch (err) {
      return send(res, 500, 'Error reading file content')
    }
  } else {
    return send(res, 400, 'Bad request')
  }
}

module.exports = router(
  get('/', clientView),
  get('/auth/slack', slackAuth(auth)),
  get('/auth/slack/callback', slackAuth(auth)),
  post('/slack/events', events),
  get('/*', catchAll)
)

