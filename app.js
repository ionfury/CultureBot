let Discord = require(`discord.js`);
let Promise = require('bluebird');
let Client = new Discord.Client();
let Config = require(`./config.json`);
let DiscordInterface = require(`./src/discordInterface.js`);

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
  
  DiscordInterface
    .EvaluateCommand(args, msg)
    .then(res => msg.channel.send(res))
    .catch(err => {
      msg.channel.send(err.message);
      console.log(err);
    });
});

Client.login(process.env.token);