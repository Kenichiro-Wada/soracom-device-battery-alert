/*global URL*/
const execSync = require('child_process').execSync;
const https = require('https');

// Environment Variable
const checkMode = process.env['SW001'];
const lteMButtonSearchType = process.env['SW002'];
const environmentVariableEncryptMode = process.env['SW003'];
const postAlertMode = process.env['SW004'];
const buttonSearchTagName = process.env['BUTTON_SEARCH_TAG_NAME'];
const buttonSearchTagValue = process.env['BUTTON_SEARCH_TAG_VALUE'];
const slackWebhookUrl = process.env['SLACK_WEBHOOK_URL'];
const gpsMultUnitBatteryTheeshold = process.env['GPS_MULTIUNIT_BATTERY_THRESHOLD'];
const iotButtonBatteryTheeshold = process.env['IOT_BUTTON_BATTERY_THRESHOLD'];


/**
 * SORACOM CLI 呼び出し部 See https://blog.soracom.jp/blog/2020/01/20/notify-slack-of-soracom-usage/
 * @param {*} args 
 */
const soracom = (args) => {
  
  return execSync(`soracom --auth-key-id ${process.env.AUTH_KEY_ID} --auth-key ${process.env.AUTH_KEY} ${args}`);
}

/**
 * GPSマルチユニット用SIM情報取得
 */
async function getGpsMultiUnitInfo() {
  const subscribersGpsMultiUnit = soracom(`subscribers list --tag-name soracom.gadgets --tag-value GPS-Multiunit`).toString();
  return JSON.parse(subscribersGpsMultiUnit);
}

/**
 * LTE-Mボタン用SIM情報取得 Tag名検索
 */
async function getLteMButtonInfoFromTagName() {
  const subscribersIotButton = soracom(`subscribers list --tag-name '${buttonSearchTagName}' --tag-value '${buttonSearchTagValue}'`).toString();
  return JSON.parse(subscribersIotButton);
}

/**
 * LTE-Mボタン用SIM情報取得 SIMグループ名検索
 */
async function getLteMButtonInfoFromSimGroup() {
  const subscribersIotButtonSimGroup = soracom(`groups list --tag-name name --tag-value '${buttonSearchTagValue}'`).toString();
  const subscribersIotButtonSimGroupObj = JSON.parse(subscribersIotButtonSimGroup)
  const subscribersIotButton = soracom(`groups list-subscribers --group-id ${subscribersIotButtonSimGroupObj[0].groupId}`).toString();
  return JSON.parse(subscribersIotButton);
}

/**
 * LTE-M Button powered by AWS 情報取得
 */
async function getLteMButtonByAwsInfo() {
  const subscribersGadgets = soracom(`gadgets list`).toString();
  return JSON.parse(subscribersGadgets);
}

/**
 * SWXXX用変換
 * @param {*} str 
 */
async function switchParamToArray(str) {
  return Array.from(str);
}

/**
 * SIMデータ取得
 * - GPSマルチユニットSORACOM Edition
 * - LTE-M Button for Enterprise
 * - LTE-M Button Plus
 * @param {*} obj 
 */
async function getSimData(obj) {
  const imisSimDataArray = new Array;
  for (let i = 0; i < obj.length; i++) {
    let battery = 0;
    const data = soracom(`data get --imsi '${obj[i].imsi}' --limit 1 `).toString();

    const dataObjContent = JSON.parse(data)[0].content;
    let isIotButton = false;
    if (JSON.parse(dataObjContent).payload) {
      // for GPS MultiUnit
      // Base64 Decode
      const gpsMultiUnitPayload  = Buffer.from(JSON.parse(dataObjContent).payload, 'base64').toString()
      battery = JSON.parse(gpsMultiUnitPayload).bat;

    } else {
      // IoT Button 
      battery = JSON.parse(dataObjContent).batteryLevel;
      isIotButton = true;
    }
    imisSimDataArray.push(
      {
        'imsi': obj[i].imsi,
        'name': obj[i].tags.name,
        'batteryLevel': battery,
        isIotButton,
      }
    )
  }
  return imisSimDataArray;
}

/**
 * LTE-M Button powered by AWS データ取得
 * @param {*} obj 
 */
async function getGadgetData(obj) {
  const gadgetDataArray = new Array;
  for (let i = 0; i < obj.length; i++) {
    gadgetDataArray.push(
      {
        'serialNumber': obj[i].serialNumber,
        'name': obj[i].tags.name,
        'batteryLevel': obj[i].lastSeen.batteryLevel
      }
    )
  }
  return gadgetDataArray;
}

/**
 * 送信用メッセージ生成
 * @param {*} data 
 */
async function createMessage(data) {
  let messageArray = [];
  console.log(`送信対象デバイス ${JSON.stringify(data, null, 2)}`);
  messageArray.push(`デバイス名: ${data.name}`);
  messageArray.push(`バッテリーレベル: ${data.batteryLevel}`);
  messageArray.push(`のため、そろそろ電池交換が必要です。`);
  return messageArray.join('\n');
}

/**
 * Slackメッセージ送信
 * @param {*} message 
 */
const postSlackMessage = (message) => {
  return new Promise((resolve, reject) => {
    let postUrl;
    try {
      postUrl = new URL(slackWebhookUrl);
    } catch (err) {
      reject(err);
    }
    const options = {
        method: 'POST',
        hostname: postUrl.hostname,
        port: postUrl.port,
        path: postUrl.pathname,
        headers: {'Content-Type':'application/json'},
    }

    const request = https.request(options, (response) => {
      if (response.statusCode === 200) {
          resolve(response);
      } else {
          reject(response);
      }
    });

    request.on('error', (err) => {
        reject(err);
    });

    request.write(JSON.stringify({text: message}));
    request.end();
  });
}

/**
 * null/undefinedチェック
 * @param {*} obj 
 */
async function isNullUndefined(obj) {
  return obj === null || typeof obj === 'undefined';
}

/**
 * メイン処理
 */
exports.handler = async (event) => {
  let noCheckFlg = false;
  let simDataArray = new Array();
  let gadgetsDataArray = new Array();
  if (await isNullUndefined(checkMode)) {
    noCheckFlg == true;
  } else {
    const checkModeArray = await switchParamToArray(checkMode);
    let noCheckCount  = 0;
    if (checkModeArray.length > 2 && checkModeArray[2] === '1') {
      const subscribersFromGpsMultiUnitInfo = await getGpsMultiUnitInfo();
      simDataArray = simDataArray.concat(await getSimData(subscribersFromGpsMultiUnitInfo));
    } else {
      noCheckCount++;
    }
    if (checkModeArray.length > 1 && checkModeArray[1] === '1') {
      let subscribersFromLteMButtonInfo;
      if (lteMButtonSearchType === '1') {
        subscribersFromLteMButtonInfo = await getLteMButtonInfoFromTagName();
      } else {
        subscribersFromLteMButtonInfo = await getLteMButtonInfoFromSimGroup();
      }
      simDataArray = simDataArray.concat(await getSimData(subscribersFromLteMButtonInfo));

    } else {
      noCheckCount++;
    } 
    if (checkModeArray.length > 0 && checkModeArray[0] === '1') {
      let gadgetInfo = await getLteMButtonByAwsInfo();
      gadgetsDataArray =　await getGadgetData(gadgetInfo);
    } else {
      noCheckCount++;
    }
    if (noCheckCount == checkModeArray.length) {
      noCheckFlg == true;
    }
  }

  if (noCheckFlg) {
    const response = {
      statusCode: 400,
      body: `No Checked.`,
    };
    return response;
  }
  const postGadgetsArray = new Array();
  for (let i = 0; i < simDataArray.length; i++) {
    const simData = simDataArray[i];
    if (simData.isIotButton) {
      // Buttonシリーズの場合
      if (simData.batteryLevel <= iotButtonBatteryTheeshold) {
        postGadgetsArray.push(simData);
        const message = await createMessage(simData);
        await postSlackMessage(message)
      }
    } else {
      if (simData.batteryLevel <= gpsMultUnitBatteryTheeshold
         && simData.batteryLevel > -1) {
        postGadgetsArray.push(simData);
        const message = await createMessage(simData);
        await postSlackMessage(message)
      }
    }
    
  }
  for (let i = 0; i < gadgetsDataArray.length; i++) {
    const gadgetsData = gadgetsDataArray[i];
    if (gadgetsData.batteryLevel <= iotButtonBatteryTheeshold) {
      postGadgetsArray.push(gadgetsData);
      const message = await createMessage(gadgetsData);
      await postSlackMessage(message);
    }
  }
  const responseBody = {
    postGadgets: postGadgetsArray
  }
  const response = {
      statusCode: 200,
      body: JSON.stringify(responseBody),
  };
  console.log("response: " + JSON.stringify(response));
  return response;
};