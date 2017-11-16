let MongoClient = require('mongodb').MongoClient;
let Promise = require('bluebird');

Promise.promisifyAll(MongoClient);

let process = {
  'env':{
    'database_connection_string':'ds155684.mlab.com:55684/culturebot',
    'database_password':'zh^q<5Q=ywzCQM4',
    'database_username':'memer',
    'token':'MzYzMDI5NTQ1NTA4NTM2MzIy.DK7RWg.I9Rq0G_zSoyTxtwlbsCiKuilHo0'
  }
}

const connectionUrl = `mongodb://${process.env.database_username}:${process.env.database_password}@${process.env.database_connection_string}`;

/**
 * Opens and closes the connection to a remote mongodb instance.
 * @param {*string} url - The connection string.
 */
function getMongoConnection(url) {
  return MongoClient.connect(url, { promiseLibrary: Promise })
    .disposer(conn => conn.close());
}

module.exports = {
  UpsertMeme: (meme, text) => {
    return new Promise.using(getMongoConnection(connectionUrl), conn => {
      var query = { meme: meme };
      var values = { meme: meme, text: text };
      var options = { upsert: true };
      return conn.collection('memes').updateOne(query, values, options);
    });
  },

  RemoveMeme: (meme) => {
    return new Promise.using(getMongoConnection(connectionUrl), conn => {
      var query = {meme: meme};      
      return conn.collection('memes').deleteOne(query);
    });
  },

  LookupMeme: (meme) => {
    return new Promise.using(getMongoConnection(connectionUrl), conn => {
      var query = { meme: meme };
      return conn.collection('memes').findOne(query);
    });
  },

  LookupMemes: () => {
    return new Promise.using(getMongoConnection(connectionUrl), conn => {
      var query = {};
      return conn.collection('memes').find(query).toArray();
    });
  }
}