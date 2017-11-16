let Discord = require(`discord.js`);
let Promise = require('bluebird');
let Config = require(`../config.json`);
let CommandLibrary = require(`./commands.js`);

const SECURITY_ERROR_MESSAGE =  `You do not have the proper security to do this.`;

function checkSecurity(msg) {
  console.log("a")
  var user = msg.author;
  var guild = msg.channel.guild;
  var guildMember = guild.members.find(x => x.id === user.id);
  var role = guild.roles.find(x => x.name === Config.bot_admin_role);
  var hasRole = guildMember.roles.has(role.id);
  
  console.log("b")
  return hasRole;  
}

module.exports =
{
  EvaluateCommand: (command, args, msg) => {
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
}