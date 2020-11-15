const axios = require('axios').default;
const { MenuParser, options } = require('@amalfilab/dsu-menu-parser');
const AWS = require('aws-sdk');
const { exit } = require('process');
require('dotenv').config();

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});

const urlTemplates = {
  martiri: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-martiri.pdf",
  rosellini: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-rosellini.pdf",
  betti: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-betti.pdf"
};

function applyUrlTemplate(template, startDate, endDate) {
  let sDay = startDate.getDate();
  let sMonth = startDate.getMonth() + 1;
  const sYear = startDate.getFullYear();
  let eDay = endDate.getDate();
  let eMonth = endDate.getMonth() + 1;
  const eYear = endDate.getFullYear();

  if (sDay <= 9) sDay = "0" + sDay;
  if (sMonth <= 9) sMonth = "0" + sMonth;
  if (eDay <= 9) eDay = "0" + eDay;
  if (eMonth <= 9) eMonth = "0" + eMonth;

  return encodeURI(template
    .replace('${START}', `${sDay}.${sMonth}.${sYear}`)
    .replace('${END}', `${eDay}.${eMonth}.${eYear}`));
}

function getMenuLinks(startDate, endDate) {  
  let links = {};
  for (key in urlTemplates) {
    links[key] = applyUrlTemplate(urlTemplates[key], startDate, endDate);
  }
  return links;
}

async function downloadPdf(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return res.data;
}

async function updateDatabase(menu, idMensa) {
  let docClient = new AWS.DynamoDB.DocumentClient();
  let updateExpr = "set ";
  let exprAttrValue = {};
  let exprAttrName = {}
  let i = 0;
  for (const elem of menu) {
    updateExpr += `menu.#d${i} = :m${i}, `
    exprAttrValue[`:m${i}`] = { launch: elem.launch, dinner: elem.dinner };
    exprAttrName[`#d${i}`] = elem.date;
    i++;
  }

  const params = {
    TableName: 'menu',
    Key: {
      idMensa
    },
    UpdateExpression: updateExpr + "updatedAt = :d",
    ExpressionAttributeNames: exprAttrName,
    ExpressionAttributeValues: {
      ...exprAttrValue,
      ":d": (new Date()).toISOString()
    }
  };

  return new Promise((resolve, reject) => {
    docClient.update(params, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function getStartEndDates(deltaWeek) {
  const now = new Date();
  const nowDay = now.getUTCDay();

  let startDate = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() - nowDay + 1 + deltaWeek*7);
  let endDate = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() - nowDay + 7 + deltaWeek*7);
  startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
  endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
  return { startDate, endDate };
}

async function getMenu(parser, parserOpts, startDate) {
  let dates = [ startDate ];
  const daysInWeek = 7;
  for (let i = 1; i < daysInWeek; ++i) {
    let d = new Date(dates[i - 1].getTime());
    d.setDate(d.getDate() + 1);
    dates.push(d);
  }

  let menu = [];
  for (const date of dates) {
    let elem = { date: date.toISOString() };
  
    if (parserOpts.openDays.includes(parseInt(date.getDay()))) {
      const day = (date.getDay() >= 1) ? date.getDay() - 1 : 6;
      const launch = (await parser.getMenu(day, 'launch')).join('; ');
      let dinner = "";
      if (parserOpts.dinner)
        dinner = (await parser.getMenu(day, 'dinner')).join('; ');
      else
        dinner = "Mensa chiusa";
      elem = { ...elem, launch, dinner };
    } else {
      elem = { ...elem, launch: "Mensa chiusa", dinner: "Mensa chiusa" };
    }

    menu.push(elem);
  }

  return menu;
}

async function fetchAndParseMenu(url, parserOpts, startDate) {
  const buffer = await downloadPdf(url).catch(err => {
    throw `Error while downloading pdf from ${url}. ${err.message}`;
  });
  const parser = new MenuParser(buffer, parserOpts)
  const menu = await getMenu(parser, parserOpts, startDate);
  return menu;
}

async function main(event) {
  const { canteen, deltaWeek } = event; 

  const { startDate, endDate } = getStartEndDates(deltaWeek);
  const url = getMenuLinks(startDate, endDate)[canteen];
  const menu = await fetchAndParseMenu(url, options[canteen], startDate);
  console.log(menu);
  await updateDatabase(menu, canteen);
}

exports.handler = async (event) => {
  console.log("event", event);
  try {
    await main(event);
    return { "statusCode": 200 };
  } catch (error) {
    console.error(error);
    return { "statusCode": 500, body: error.message };
  }
}