
let Promise = require('bluebird');
let RequestPromise = require('request-promise');

const ION_FURY_CHARACTER_ID = 238644413;
const DEFAULT_ESI_URL = `https://esi.tech.ccp.is`;
const DEFAULT_ESI_DATASOURCE = `tranquility`;
const DEFAULT_ESI_SERVER = `latest`;

/**
 * Authroizes a token through ESI. 
 * @param {string} token The code.
 * @returns A RequestPromise.
 */
function authToken(token){
  var options = {
    method: 'POST',
    url: "https://login.eveonline.com/oauth/token",
    headers: {
      "authorization": "Basic " + Buffer.from(process.env.client_id+":"+process.env.client_secret).toString('base64'),
      "content-type": "application/json"
    },
    json: {
      "grant_type":"authorization_code",
      "code":token
    }
  };

  return RequestPromise(options);
}

/**
 * Refreshes a token through ESI.
 * @param {string} token The refresh_token.
 * @returns a RequestPromise.
 */
function refreshToken(token) {
  var options = {
    method: 'POST',
    url: "https://login.eveonline.com/oauth/token",
    headers: {
      "Authorization": "Basic " + Buffer.from(process.env.client_id+":"+process.env.client_secret).toString('base64'),
      "content-type": "application/json"
    },
    json: {
      "grant_type":"refresh_token",
      "refresh_token": token
    }
  };

  return RequestPromise(options)
    .then(x => {return x.access_token});
}

/**
 * Verifies a token through ESI.
 * @param {string} token Verification token
 * @returns a RequestPromise.
 */
function verifyToken(token) {
  var options = {
    method: 'GET',
    url: "https://login.eveonline.com/oauth/verify",
    headers: {
      "authorization" : "Bearer " + token
    }
  };

  return RequestPromise(options);
}

function getSystemIDPromise(system) {
  let options = {
    route: 'search',
    parameters:`categories=solar_system&search=${system}`
  };

  return esiGet(options)
  .then(JSON.parse)
  .then(res => {
    if(!res.solar_system) 
      throw new Error('Solarsystem not found!');
    else
      return res.solar_system.shift();
  });
}

function getItemIDStrictPromise(item) {
  let options = {
    route:'search',
    parameters: `categories=inventory_type&search=${item}&strict=true`
  }

  return esiGet(options)
    .then(JSON.parse)
    .then(res => {
      if(!res.inventory_type) 
        return getItemIDPromise(item);
      else
        return res.inventory_type.shift();
    });
}

function getItemIDPromise(item) {
  let options = {
    route:'search',
    parameters: `categories=inventory_type&search=${item}`
  }

  return esiGet(options)
    .then(JSON.parse)
    .then(res => {
      if(!res.inventory_type) 
        throw new Error(`Inventorytype not found for '${item}'!`);
      else
        return res.inventory_type.shift();
    });
}

function getSystemNameFromIDPromise(solarsystemID) {
  let options = {
    route:`universe/systems/${solarsystemID}`
  };

  return esiGet(options)
    .then(JSON.parse)
    .then(res => {
      if(!res.name)
        throw new Error('Invalid solarsystemID returned!');
      else
        return res.name;
    });
}

/**
 * Creates a promise to ESI.
 * @param {*options} options Yeah figure it out asshole. 
 * @returns a Request Promise
 */
function esiGet(options) {
  var route = options.route || ``;
  var parameters = options.parameters || ``;
  var token = options.token || ``;
  var page = options.page || 1;
  var datasource = options.datasource || DEFAULT_ESI_DATASOURCE;
  var server = options.server || DEFAULT_ESI_SERVER;
  var url = options.url || DEFAULT_ESI_URL;

  var options = {
    method: 'GET',
    url: `${url}/${server}/${route}?datasource=${datasource}&page=${page}${options.token ? `&token=${options.token}` : ``}&${parameters}`
  }
  return RequestPromise(options);
}

function getStructureMarket(token, structure) {
  let options = {
    token: token,
    route: `markets/structures/${structure}`
  };
  
  return esiGet(options).then(JSON.parse)
    .catch(err => []); //mute empty markets
}

function getTypeInfoPromise(typeID) {
  let options = {
    route: `universe/types/${typeID}`
  };

  return esiGet(options).then(JSON.parse);
}

function getCitadelMarketInfo(system, item) {
  let getSystemID = getSystemIDPromise(system);
  let getItemID = getItemIDStrictPromise(item);
  let getTypeInfo = getItemID.then(getTypeInfoPromise);
  let getSystemName = getSystemID.then(getSystemNameFromIDPromise);
  let getRefreshToken = refreshToken(process.env.refresh_token);

  let getSystemStructures = Promise.join(getRefreshToken, getSystemName, (token, name) => {
    let options = {
      token: token,
      route: `characters/${ION_FURY_CHARACTER_ID}/search`,
      parameters: `categories=structure&search=${name}`
    };
    return esiGet(options).then(JSON.parse);
  });

  let getStructureMarkets = Promise.join(getRefreshToken, getSystemStructures, getSystemName, (token, structures, systemName) => {
    if(!structures.structure)
      throw new Error(`No structures found in **${systemName}**`);
    return Promise.map(structures.structure, structure => getStructureMarket(token, structure))
  });

  return Promise.join(getItemID, getTypeInfo, getSystemName, getSystemStructures, getStructureMarkets, (itemID, typeInfo, systemName, systemStructures, structureMarkets) => {
    let itemOrders = structureMarkets
      .reduce((prev, curr) => prev.concat(curr), [])
      .filter(order => order.type_id === itemID);
    let buyOrders = itemOrders
      .filter(order => order.is_buy_order === true);
    let sellOrders = itemOrders
      .filter(order => order.is_buy_order === false);

    let maxBuy = buyOrders.map(order => order.price).reduce((prev, curr) => prev > curr ? prev : curr, 0);
    let buyVolume = buyOrders.map(order => order.volume_remain).reduce((prev, curr) => prev + curr, 0);
    let minSell = sellOrders.map(order => order.price).reduce((prev, curr) => prev < curr ? prev : curr, 99999999999999);
    let sellVolume = sellOrders.map(order => order.volume_remain).reduce((prev, curr) => prev + curr, 0);

    return formatInfo(
      systemName,
      typeInfo.name,
      typeInfo.type_id,
      typeInfo.volume,
      typeInfo.packaged_volume,
      maxBuy,
      buyVolume,
      minSell,
      sellVolume
    );
  });
}

function pretty(number) {
  let length = Math.round(number).toString().length;
  let pretty = ``;

  if(length <= 3)
    pretty = number.toString();
  else if(4 <= length && length <= 6)
    pretty = `${Math.round(number/1000 * 10) / 10}k`; //thousands
  else if(7 <= length && length <= 9)
    pretty = `${Math.round(number/1000000 * 10) / 10}m`; //millions
  else if(10 <= length && length <= 12)
    pretty = `${Math.round(number/1000000000 * 10) / 10}b`; //billions
  else if(11 <= length && length <= 15)
    pretty = `${Math.round(number/1000000000000 * 10) / 10}t`; //trillions
  else
    pretty = `lol`;

  return pretty;
}

function formatInfo(system, type, id, volume, packaged_volume, buy, buyVol, sell, sellVol) {
  return `\nSystem: **${system}**
  \n\tItem: **${type}** (id:${id}, vol:${pretty(volume)} m3, packaged:${pretty(packaged_volume)} m3)
  \n\tBuy: $${pretty(buy)}, vol ${pretty(buyVol)} units
  \n\tSell: $${pretty(sell)}, vol ${pretty(sellVol)} units`;
}

function getFuzzworkMarketDataPromise(stationID, typeID) {

  var options = {
    method: 'GET',
    url: `https://market.fuzzwork.co.uk/aggregates/?station=${stationID}&types=${typeID}`
  }

  return RequestPromise(options).then(JSON.parse);
}

function getMarketHubInfo(system, item) {
  var stationID = 0;
  switch(system) {
    case 'jita':
      stationID = 60003760;
      break;
    case 'amarr':
      stationID = 60008494;
      break;
    case 'dodixie':
      stationID = 60011866;
      break;
    case 'rens':
      stationID = 60004588;
      break;
    case 'hek':
      stationID = 60005686;
      break;
  }
  let getItemID = getItemIDStrictPromise(item);
  let getTypeInfo = getItemID.then(getTypeInfoPromise);
  let getFuzzworkMarketData = getItemID.then(itemID => getFuzzworkMarketDataPromise(stationID, itemID));

  return Promise.join(getTypeInfo, getFuzzworkMarketData, (typeInfo, marketData) => {
    return formatInfo(
      system,
      typeInfo.name,
      typeInfo.type_id,
      typeInfo.volume,
      typeInfo.packaged_volume,
      marketData[typeInfo.type_id].buy.max,
      marketData[typeInfo.type_id].buy.volume,
      marketData[typeInfo.type_id].sell.min,
      marketData[typeInfo.type_id].sell.volume);
  });
}

module.exports = {
  GetItemPrice: (system, item) => {
    var hubs = ['jita', 'amarr', 'dodixie', 'rens', 'hek'];
    if(hubs.includes(system))
      return getMarketHubInfo(system, item);
    else
      return getCitadelMarketInfo(system, item);
    
  },

  Get: (options) => {
    return esiGet(options);
  }
}