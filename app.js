const Discord = require(`discord.js`);
const Promise = require('bluebird');
const MongoClient = require('mongodb').MongoClient;
const Client = new Discord.Client();
const Config = require(`./config.json`);

Client.on('ready', () => {
  console.log(`\nBot has started, with ${Client.users.size} users, in ${Client.channels.size} channels of ${Client.guilds.size} guilds.`); 
});

Client.on('message', msg => {
  if(msg.author.bot) return;
  if(msg.content.indexOf(Config.prefix) !== 0) return;
  if(!msg.guild) {
    msg.reply(`Please converse with me in a guild channel instead.`);
    return;
  }
  var botAdminRole = msg.guild.roles.find(role => role.name === Config.bot_admin_role);
  if(!botAdminRole) {
    msg.channel.send(`Bot admin role named ${Config.bot_admin_role} must exist.`);
    return;
  }

  var args = msg.content.slice(Config.prefix.length).trim().split(/ +/g);
  var command = args.shift().toLowerCase();
  console.log(`\nCommand received: ${command}, with arguments: ${args.join(', ')}, from user ${msg.author}.`);
  

  if(command === 'help') {
    msg.channel.send(`\n${Config.prefix}<meme>\n${Config.prefix}add <meme> <text>\n${Config.prefix}remove <meme>`);
  }
  else if(command === 'add' && args.length > 1) {
    var meme = args[0];
    var content = msg.content;

    content = content.slice(Config.prefix.length);
    content = content.slice('add '.length);
    content = content.slice(meme.length+1);
    
    upsertMeme(meme, content)
      .then(added => {
        if(added.addedCount == 0)
          throw new Error("can't do that");

        msg.channel.send(`LONG LIVE ${meme}!`);
      })
      .catch(err => {
        msg.channel.send(`:colbert: ${err}`)
      });
  } else if (command === 'remove') {
    var meme = args[0];
    killMeme(meme)
      .then(dead => {
        if(dead.deletedCount == 0)
          throw new Error("can't do that");

        msg.channel.send(`:skull_crossbones::skull_crossbones: R I P MEME ${meme} :skull_crossbones::skull_crossbones:`)
      })
      .catch(err => {
        msg.channel.send(`:colbert: ${err}`)
      });
  } else if (args.length === 0) {
    lookupMeme(command)
      .then(meme => {
        console.log(meme);
        if(!meme)
          throw new Error("lol what?");

        msg.channel.send(meme.text);
      })
      .catch(err => {
        msg.channel.send(`:colbert: ${err}`)
      });
  }
});

function upsertMeme(meme, text) {
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = { meme: meme };
    var values = { meme: meme, text: text };
    var options = { upsert: true };
    
    return conn.collection('memes').updateOne(query, values, options);
  });
}

function killMeme(meme) {
  console.log(meme);
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = {meme: meme};
    console.log(meme);

    return conn.collection('memes').deleteOne(query);
  })
}

function lookupMeme(meme) {
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = { meme: meme };

    return conn.collection('memes').findOne(query);
  });
}

var connectionUrl = `mongodb://${Config.database_username}:${Config.database_password}@${Config.database_connection_string}`;

/**
 * Opens and closes the connection to a remote mongodb instance.
 * @param {*string} url - The connection string.
 */
function getMongoConnection(url) {
  return MongoClient.connect(url, { promiseLibrary: Promise })
    .disposer(conn => conn.close());
}

Client.login(Config.token);