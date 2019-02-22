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

// bot,reminders:read,chat:write:bot,reminders:write,team:read,channels:history,groups:history,channels:read,groups:read,users:read

const Slack = require('./lib/slack')
const config = require('./config')
const { to } = require('./utils')

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
  storage: { mongoUri }
} = config

const storage = require('./lib/storage')({mongoUri})

const slackAuth = authSlack({
  clientId,
  clientSecret,
  callbackUrl,
  scope,
  path: '/auth/slack'
})

const auth = async (req, res, auth) => {
  if(!auth) return send(res, 404, 'Not Found')
  if (auth.err) return send(res, 403, new Error(auth.err))
  console.log(auth)
  return send(res, 200, '<p>Snoozebot was successfully installed on your team.</p>')
}

const events = async (req, res) => {
  try {
    const [err, payload] = await to(json(req))
    if (err) throw new Error(err)
    if (payload.token && verificationToken !== payload.token) throw new Error(`unauthorized`)
    if (payload.type === 'url_verification') return send(res, 200, JSON.stringify(payload))
    if (payload.type !== 'event_callback') return send(res, 200)
    if (payload.event.type !== 'reaction_added') return send(res, 200)

    const { event } = payload
    const { type, user: userId, item, reaction, item_user, event_ts
    } = payload.event

    const slack = new Slack(token)
    const [team, user, channel, message] = await Promise.all([
      slack.getTeam(),
      slack.getUser(userId),
      slack.getChannel(item.channel),
      slack.getMessage(item.channel, item.ts)
    ])
    const reminder = await slack.addReminder({
      event,
      team,
      channel,
      user
    })
    await slack.whisper({
      event,
      reminder,
      message,
      user,
      team
    })
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
        path.resolve(__dirname, './assets', assetPath),
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
    assetsDir: '/assets'
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
  const reqPath = decodeURIComponent(path.format(pathObj))

  if (pathname.startsWith('/assets/')) {
    const asset = await getAsset(pathname.replace('/assets/', ''))
    res.setHeader('Content-Type', `${mime.getType(pathname)}; charset=utf-8`)
    return send(res, 200, asset)
  }

  if (!await exists(reqPath)) {
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
  post('/slack/events',
    rateLimit({ window: 10000, limit: 1, headers: true }, events)),
  get('*', catchAll)
)

