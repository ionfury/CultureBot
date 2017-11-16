let Discord = require(`discord.js`);
let Promise = require('bluebird');
let Client = new Discord.Client();
let Config = require(`./config.json`);
let CommandLibrary = require(`./src/commands.js`);

const SECURITY_ERROR_MESSAGE =  `You do not have the proper security to do this.`;

function checkSecurity(msg) {
  var user = msg.author;
  var guild = msg.channel.guild;
  var guildMember = guild.members.find(x => x.id === user.id);
  var role = guild.roles.find(x => x.name === Config.bot_admin_role);
  var hasRole = guildMember.roles.has(role.id);
  
  return hasRole;  
}

function EvaluateCommand(command, args, msg) {
  return new Promise((res,rej) => {
    let response = ``;

    switch(command) {
      case 'help':
        response = CommandLibrary.Help();
        break;
      case 'time':
        response = CommandLibrary.Time();
        break;
      case 'how':
        response = CommandLibrary.How();
        break;
      case 'list':
        response = CommandLibrary.List();
        break;
      case 'add':
        var meme = args[0];
        var content = msg.content.slice(Config.prefix.length).slice('add '.length).slice(meme.length+1);
        response = checkSecurity(msg) ? CommandLibrary.Add(meme, content) : SECURITY_ERROR_MESSAGE;
        break;
      case 'remove':
        response = checkSecurity(msg) ? CommandLibrary.Remove() : SECURITY_ERROR_MESSAGE;
        break;
      default:
        response = CommandLibrary.Default();
        break;
    }
    res(response);
  });
}

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
  
  EvaluateCommand(args, msg)
    .then(res => msg.channel.send(res))
    .catch(err => {
      msg.channel.send(err.message);
      console.log(err);
    });
});

Client.login(process.env.token);