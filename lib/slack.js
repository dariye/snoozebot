const { WebClient } = require('@slack/client')
const moment = require('moment-timezone')
const { to } = require('../utils')

class Slack {
  constructor(token) {
    this.client = new WebClient(token)
  }

  async getChannel (id) {
    if (this.constructor.isChannel(id)) {
      const [err, data] = await to(this.client.channels.info({ channel: id }))
      if (err)
        throw new Error(`Error fetching channel`)
      return data.channel
    }
    if (this.constructor.isGroup(id)) {
      const [err, data] = await to(this.client.groups.info({ channel: id }))
      if (err)
        throw new Error(`Error fetching group`)
      return data.group
    }
  }

  async getMessage (id, timestamp) {
    let err, data
    if (this.constructor.isGroup(id))
      [err, data] = await to(this.client.groups.history({
        channel: id, latest: timestamp, inclusive: true, count: 1 }))
    if (this.constructor.isChannel(id))
      [err, data] = await to(this.client.channels.history({
        channel: id, latest: timestamp, inclusive: true, count: 1 }))
      if (err)
        throw new Error(`Error fetching event`)
    return data.messages[0]
  }

  async getUser (id) {
    const [err, data] = await to(this.client.users.info({ user: id }))
    if (err)
      throw new Error(`Error fetching user`)
    return data.user
  }

  async getTeam () {
    const [err, data] = await to(this.client.team.info())
    if (err)
      throw new Error(`Error fetching team`)
    return data.team
  }

  async addReminder ({ channel, team, user, event: { item: { ts } } }) {
    const link = `<https://${team.domain}.slack.com/archives/${channel.id}/p${ts.replace('.', '')}|this message>`
    const text = `about ${link} from <@${user.id}> in ${channel.name}`
    const time = `in 1 hour`
    const [err, reminder] = await to(this.client.reminders.add({ user: user.id, text, time }))
    if (err) throw new Error(`Error posting slack message`)
    return { ...reminder, time }
  }

  async whisper ({
    team,
    user,
    time,
    reminder,
    message,
    event: { item, item_user }
  }) {
    console.log(user)
    const now = moment(moment().tz(user.tz))
    const snoozeTime = `${time} at ${now.add(1, 'hour').format('HH:mm')} ${now.diff(now, 'days') > 0 ? 'tomorrow' : 'today'}`

    const link = `<https://${team.domain}.slack.com/archives/${item.channel}/p${item.ts.replace('.', '')}|this message>`
    const from = `from ${item_user === reminder.user ? 'you' : '<@' + item_user + '>' }`
    const when = `${snoozeTime}.`

    const text = `:thumbsup_all: I will remind you to come back to ${link} ${from}\n(${message.text.substr(0, 50)}) ${when}`

    const [err, data] = await to(this.client.chat.postEphemeral({
      channel: item.channel, text, user: user.id }))
    if (err) throw new Error(err)
    return data
  }

  static isChannel (id) {
    return /^[C]+/g.test(id)
  }

  static isGroup (id) {
    return /^[G]+/g.test(id)
  }
}

module.exports = Slack
