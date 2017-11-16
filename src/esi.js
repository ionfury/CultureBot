
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
    parameters:`categories=solarsystem&search=${system}`
  };

  return esiGet(options)
  .then(JSON.parse)
  .then(res => {
    if(!res.solarsystem) 
      throw new Error('Solarsystem not found!');
    else
      return res.solarsystem.shift();
  });
}

function getItemIDPromise(item) {
  let options = {
    route:'search',
    parameters: `categories=inventorytype&search=${item}`
  }

  return esiGet(options)
    .then(JSON.parse)
    .then(res => {
      if(!res.inventorytype) 
        throw new Error('Inventorytype not found!');
      else
        return res.inventorytype.sort().shift();
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
  let getItemID = getItemIDPromise(item);
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
    if(!structures.structure == 0)
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
    let minSell = sellOrders.map(order => order.price).reduce((prev, curr) => prev < curr ? prev : curr, 0);
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

function formatInfo(system, type, id, volume, packaged_volume, buy, buyVol, sell, sellVol) {
  return `\nSystem: **${system}**
  \n\tItem: **${type}** (id:${id}, vol:${volume.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m3, packaged:${packaged_volume.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m3)
  \n\tBuy: $${buy.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}, vol ${buyVol.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} units
  \n\tSell: $${sell.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}, vol ${sellVol.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} units`;
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
  let getItemID = getItemIDPromise(item);
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