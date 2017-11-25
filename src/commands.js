let Promise = require('bluebird');
let Database = require(`./database.js`);
let ESI = require(`./esi.js`);
let Config = require(`../config.json`);

module.exports = {
  Help: () => {
    return '```'
      +`${Config.prefix}list
      ${Config.prefix}<meme>
      ${Config.prefix}add <meme> <text>
      ${Config.prefix}remove <meme>
      ${Config.prefix}time
      ${Config.prefix}price <system> <item>`+'```'
  },

  Time: () => {
    let d = new Date();
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  
    let pst = new Date(utc - (3600000 * 8)).toTimeString().split(' ')[0];
    let est = new Date(utc - (3600000 * 5)).toTimeString().split(' ')[0];
    let cet = new Date(utc + (3600000 * 1)).toTimeString().split(' ')[0];
    let msk = new Date(utc + (3600000 * 3)).toTimeString().split(' ')[0];
    let aest = new Date(utc + (3600000 * 11)).toTimeString().split(' ')[0];
    utc = new Date(utc).toTimeString().split(' ')[0];
  
    let message = `**EVE Time**: ${utc} --`;
    message += `**PST/Lost Angeles**: ${pst} --`;
    message += `**EST/New York**: ${est} --`;
    message += `**CET/Copenhagen**: ${cet} --`;
    message += `**MSK/Moscow**: ${msk} --`;
    message += `**AEST/Sydney**: ${aest}`;
  
    return message;
  },

  How: () => {
    return `http://i0.kym-cdn.com/entries/icons/original/000/021/158/bleach.jpg`;
  },

  List: () => {
    return Database.LookupMemes()
      .then(memes => memes.map(meme => meme.meme).sort().join(`\n${Config.prefix}`))
      .then(x => `\`\`\`${x}\`\`\``)
  },

  GetMeme: (meme) => {
    return Database.LookupMeme(meme)
      .then(returned => {
        if(!returned)
          return `http://i0.kym-cdn.com/photos/images/original/000/993/875/084.png`;
        else
          return returned.text;
      });
  },

  AddMeme: (meme, content) => {
    return Database.UpsertMeme(meme, content)
      .then(added => `Long live **${meme}**!`);
  },

  RemoveMeme: (meme) => {
    return Database.RemoveMeme(meme)
      .then(removed => {
        console.log(removed)
        return `RIP **${meme}**!`});
  },

  Default: () => {
    return `http://i0.kym-cdn.com/photos/images/original/000/993/875/084.png`;
  },

  Price: (system, item) => {
    return ESI.GetItemPrice(system, item);
  }
}
