const { WebClient } = require('@slack/client')
const moment = require('moment')
const { to } = require('../utils')

class Slack {
  constructor(token, { event = {} }) {
    const { type, user, item, reaction, item_user, event_ts } = event
    this._client = new WebClient(token)
    this._team = null
    this._channel = null
    this._event = null
    this._timestamp = item.ts
    this._client.team.info().then((data) => {
      this._team = data.team
    }).catch(err => console.log(err))
  }

  set channel (channel) {
    if (this.isChannel(channel)) {
      this._client.channels.info({ channel }).then((data) => {
        this._channel = data.channel
      }).catch(err => console.log(err))
    }
    if (this.isGroup(channel)) {
      this._client.groups.info({ channel }).then((data) => {
        this._group = data.group
      }).catch(err => console.log(err))
    }
  }

  set event (channel) {
    const latest = this._ts
    if (this.isGroup(channel)) {
      this._client.groups.history({ channel, latest, inclusive: true, count: 1 })
        .then((data) => {
          this._event = data.messages[0]
        }).catch(err => console.log(err))
    }
    if (this.isChannel(channel)) {
      this._client.channels.history({ channel, latest, inclusive: true, count: 1 })
        .then((data) => {
          this._event = data.messages[0]
        }).catch(err => console.log(err))
    }
  }

  get team () {
    return  this._team
  }

  get channel () {
    return this._channel
  }

  get event () {
    return this._event
  }

  async addReminder () {
    const client = this._client
    const channel = this._channel
    const team = this._team
    const event = this._event
    const timestamp = this._timestamp

    const link = `<https://${team.domain}.slack.com/archives/${channel.id}/p${timestamp.replace('.', '')}|this message>`

    const text = `about ${link} from <@${item_user}> in ${channel.name}`
    const time = `in 1 hour`

    const [err, reminder] = await to(this._client.reminders.add({ text, user, time }))
    if (err) throw new Erro(err)
    return { ...reminder, message: event, timeInterval: time }
  }

  async whisper ({
    timeInterval,
    reminder: { user, time },
    message: { text: messageText },
    event: { item: { channel, ts }, item_user }
  }) {
    const team = this._team
    const now = moment()
    const snoozeTime = moment(time)

    const link = `<https://${team.domain}.slack.com/archives/${channel}/p${ts.replace('.', '')}|this message>`
    const from = `from ${item_user === user ? 'you' : '<@' + item_user + '>' }`
    const message = `(${messageText.substr(0, 50)})`
    const when = `${timeInterval} at ${now.add(1, 'hour').format('HH:mm')} ${snoozeTime.diff(now, 'days') > 0 ? 'tomorrow' : 'today'}.`

    const text = `:thumbsup_all: I will remind you to come back to ${link} ${from}\n${message} ${when}`

    const [err, data] = await to(this._client.chat.postEphemeral({ channel, text, user }))
    if (err) throw new Error(err)
    return data
  }

  isChannel (id) {
    return /^[C]+/g.test(id)
  }

  isGroup (id) {
    return /^[G]+/g.test(id)
  }
}

module.exports = Slack
