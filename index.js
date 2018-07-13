const { send, json } = require('micro')
const { router, get, post }  = require('microrouter')
const { WebClient } = require('@slack/client')
const microAuthSlack = require('microauth-slack')
const moment = require('moment')

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

const channelInfo = async (channel) => {
  const [err, data] = await to(web.channels.info({ channel }))
  if (err) throw new Error(err)
  return data.channel
}

const groupInfo = async (channel) => {
  const [err, data] = await to(web.groups.info({ channel }))
  if (err) throw new Error(err)
  return data.group
}

const findChannel = async (id) => {
  if (/^[G]+/g.test(id)) return await groupInfo(id)
  if (/^[C]+/g.test(id)) return await channelInfo(id)
}

const findEvent = async (channel, latest) => {
  let err, event
  if (/^[G]+/g.test(channel)) {
    [err, event] = await to(web.groups.history({ channel, latest, inclusive: true, count: 1 }))
  }
  if (/^[C]+/g.test(channel)) {
    [err, event] = await to(web.channels.history({ channel, latest, inclusive: true, count: 1 }))
  }
  if (err) throw new Error(err)
  return event
}

const findUser = async (user) => {
  const [err, data] = await to(web.users.info({ user }))
  if (err) throw new Error(err)
  return data.user
}

const addReminder = async ({
  type, user, item, reaction, item_user, event_ts
}) => {
  const channel = await findChannel(item.channel)
  const { messages } = await findEvent(channel.id, item.ts)
  const text = `About <https://andela.slack.com/archives/${channel.id}/p${item.ts.replace('.', '')}|this message> from <@${item_user}> in ${channel.name}`
  const time = `in 2 hours`
  const [err, reminder] = await to(web.reminders.add({ text, user, time }))
  if (err) throw new Erro(err)
  return { ...reminder, message: messages[0] }
}

const whisper = async ({
  ok,
  reminder: { user, time },
  message: { text: messageText },
  event: { item: { channel, ts }, item_user }
}) => {
  if (!ok) return
  const now = moment()
  const snoozeTime = moment(time)
  const text = `:thumbsup_all: I will remind you to come back to <https://andela.slack.com/archives/${channel}/p${ts.replace('.', '')}|this message> from ${item_user === user ? 'you' : '<@' + item_user + '>' }\n(${messageText.substr(1, 50)}) in 2 hours at ${snoozeTime.format('hh:mm')} ${snoozeTime.diff(now, 'days') > 0 ? 'tomorrow' : 'today'}.`
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
    if (type === 'url_verification') return send(res, 200, JSON.stringify(payload))
    if (type !== 'event_callback' && event.reaction !== reaction) return send(res, 200)
    if (!event.item_user) return
    if (event.type === 'reaction_added') {
      const reminder = await addReminder(event)
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
  // get('/', index),
  // get('/auth/slack', slackAuth(auth)),
  // get('/auth/slack/callback', slackAuth(auth)),
  post('/slack/events', events),
  // get('#<{(|', notfound)
)

