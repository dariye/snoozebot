const { send, json } = require('micro')
const { router, get, post }  = require('microrouter')
const { WebClient } = require('@slack/client')
const microAuthSlack = require('microauth-slack')

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
  }
} = require('./config')
const { to } = require('./utils')

const web = new WebClient(token)
const options = {
  clientId,
  clientSecret,
  callbackUrl,
  scope,
  path: '/auth/path'
}

const slackAuth = microAuthSlack(options)

const index = (req, res) => {
  return send(res, 200, `<a href="https://slack.com/oauth/authorize?client_id=289290819732.396355442160&scope=reactions:read,bot,reminders:write,reminders:read,chat:write:bot"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a>`)
}

const auth = async (req, res, auth) => {
  if(!auth) {
    return send(res, 404, 'Not Found')
  }
  if (auth.err) {
    console.error(auth.err)
    return send(res, 403, 'Forbidden')
  }
  console.log(auth)
  return send(res, 200, '<p>Nudge was successfully installed on your team.</p>')
}

const addReminder = async ({
  type, user, item, reaction: reacted, event_ts
}) => {
  if (reacted !== reaction) return
  const now = moment()
  const text = `You asked me to remind you to get back to something`
  const time = `in one hour`
  const [err, reminder] = await to(web.reminders.add({ text, user, time }))
  if (err) throw new Erro(err)
  return reminder
}

const whisper = async ({
  ok,
  reminder: { user },
  event: { item: { channel } }
}) => {
  if (!ok) return
  const text = `I'll remind you in an hour to come back to this`
  const [err, message] = await to(web.chat.postEphemeral({ channel, text, user }))
  if (err) throw new Error(err)
  return message
}

const events = async (req, res) => {
  try {
    const [err, payload] = await to(json(req))
    if (err) throw new Error(err)
    if (payload && verificationToken !== payload.token) throw new Error(`unauthorized`)
    const { type, event } = payload
    if (type === 'url_verification') {
      console.log(payload)
      return send(res, 200, JSON.stringify(payload))
    }
    if (type === 'event_callback' && event.type === 'reaction_added') {
      const reminder = await addReminder(payload.event)
      const message = await whisper({ ...reminder, event })
    }
    return send(res, 200)
  } catch(err) {
    console.log(err)
    return send(res, 500, err)
  }
}

const notfound = (req, res) => send(res, 404, 'Not found')
module.exports = router(
  get('/', index),
  get('/auth/slack', slackAuth(auth)),
  get('/auth/slack/callback', slackAuth(auth)),
  post('/slack/events', events),
  get('/*', notfound)
)

