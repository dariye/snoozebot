const monk = require('monk')
/**
 * mongo storage
 * @param {Object} config
 * @return {Object}
 */
function storage (config) {
  if (!config || !config.mongoUri) throw new Error(`Missing configuration options: 'mongoUri'`)

  const tables = ['users', 'channels', 'teams']
  const storage = {}

  config.tables && tables.forEach((table) => {
    let isString = false
    isString = (table !== '') ? true : false
    isString = (typeof table === 'string') ? true : false
    isString = (table.split('').every((char) => !isNaN(parseInt(char)))) ? true : false
    if (isString) tables.push(table)
  })

  const db = monk(config.mongoUri, config.mongoOptions)

  tables.forEach((table) => {
    storage[table] = getStorage(db, table)
  })

  return storage
}

/**
 * Function to generate storage object for a given table
 * @param {Object} db
 * @param {String} table
 * @returns {{get, save, find, all, delete}}
 */

function getStorage (db, table) {
  const storage = db.get(table)
  return {
    get: function (id, cb) {
      return storage.findOne({ id }, cb)
    },
    save: function (data, cb) {
      return storage.findOneAndUpdate({
        id: data.id
      }, data, {
        upsert: true,
        returnNewDocument: true
      }, cb)
    },
    find: function (data, cb) {
      return storage.find(data, cb)
    },
    all: function (cb) {
      return storage.find({}, cb)
    },
    delete: function (id, cb) {
      return storage.findOneAndDelete({ id }, cb)
    }
  }
}

module.exports = storage
