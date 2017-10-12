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
    msg.channel.send('```'+`\n${Config.prefix}list\n${Config.prefix}<meme>\n${Config.prefix}add <meme> <text>\n${Config.prefix}remove <meme>`+'```');
  }
  if(command === 'time') {
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);

    var pst = new Date(utc - (3600000 * 7)).toTimeString().split(' ')[0];
    var est = new Date(utc - (3600000 * 4)).toTimeString().split(' ')[0];
    var cet = new Date(utc + (3600000 * 2)).toTimeString().split(' ')[0];
    var msk = new Date(utc + (3600000 * 3)).toTimeString().split(' ')[0];
    var aest = new Date(utc + (3600000 * 11)).toTimeString().split(' ')[0];
    utc = new Date(utc).toTimeString().split(' ')[0];

    var message = `**EVE Time**: ${utc} --`;
    message += `**PST/Lost Angeles**: ${pst} --`;
    message += `**EST/New York**: ${est} --`;
    message += `**CET/Copenhagen**: ${cet} --`;
    message += `**MSK/Moscow**: ${msk} --`;
    message += `**AEST/Sydney**: ${aest}`;

    msg.channel.send(message);
  }
  else if (command === 'how') {
    msg.channel.send(`http://i0.kym-cdn.com/entries/icons/original/000/021/158/bleach.jpg`);
  }
  else if (command === 'list') {
    lookupMemes()
      .then(memes => {
        msg.channel.send('```' + memes.map(x => x.meme).sort().join(`\n${Config.prefix}`)+'```');
      })
      .catch(err => {
        msg.channel.send(err);
      })
  }
  else if(command === 'add' && args.length > 1) {
    var user = msg.author;
    var guild = msg.channel.guild;
    var guildMember = guild.members.find(x => x.id === user.id);
    var role = guild.roles.find(x => x.name === Config.bot_admin_role);
    var hasRole = guildMember.roles.has(role.id);
    
    if(!hasRole) {
      msg.reply(`you need **${role.name}**`);
      return
    }
    
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
    var user = msg.author;
    var guild = msg.channel.guild;
    var guildMember = guild.members.find(x => x.id === user.id);
    var role = guild.roles.find(x => x.name === Config.bot_admin_role);
    var hasRole = guildMember.roles.has(role.id);
    
    
    if(!hasRole) {
      msg.reply(`you need **${role.name}**`);
      return
    }

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
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = {meme: meme};
    console.log(meme);

    return conn.collection('memes').deleteOne(query);
  })
}

function lookupMemes() {
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = {};

    return conn.collection('memes').find(query).toArray();
  })
}

function lookupMeme(meme) {
  return new Promise.using(getMongoConnection(connectionUrl), conn => {
    var query = { meme: meme };

    return conn.collection('memes').findOne(query);
  });
}

var connectionUrl = `mongodb://${process.env.database_username}:${process.env.database_password}@${process.env.database_connection_string}`;

/**
 * Opens and closes the connection to a remote mongodb instance.
 * @param {*string} url - The connection string.
 */
function getMongoConnection(url) {
  return MongoClient.connect(url, { promiseLibrary: Promise })
    .disposer(conn => conn.close());
}

Client.login(process.env.token);