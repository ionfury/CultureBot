let Discord = require(`discord.js`);
let Promise = require('bluebird');
let Config = require(`../config.json`);
let CommandLibrary = require(`./commands.js`);

const SECURITY_ERROR_MESSAGE =  `You do not have the proper security to do this.`;

function checkSecurity(msg) {
  var user = msg.author;
  var guild = msg.channel.guild;
  var guildMember = guild.members.find(x => x.id === user.id);
  var role = guild.roles.find(x => x.name === Config.bot_admin_role);
  var hasRole = guildMember.roles.has(role.id);
  
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
          if(args.length < 1)
            throw new Error('Gimme the meme, man.');
          var meme = args[0];
          var content = msg.content.slice(Config.prefix.length).slice('add '.length).slice(meme.length+1);
          response = checkSecurity(msg) ? CommandLibrary.AddMeme(meme, content) : SECURITY_ERROR_MESSAGE;
          break;
        case 'remove':
          if(args.length < 1)
            throw new Error('Gimme the meme, man.');
          var meme = args[0];
          response = checkSecurity(msg) ? CommandLibrary.RemoveMeme(meme) : SECURITY_ERROR_MESSAGE;
          break;
        case 'price':
          if(args.length < 2)
            throw new Error('Gimme a system and an item, man.');
          response = CommandLibrary.Price(args[0], args[1]);
          break;
        default:
          response = CommandLibrary.GetMeme(command);
          break;
      }
      res(response);
    });
  }
}