var AWS = require("aws-sdk");
const path = require("path");
require('dotenv').config({path: path.resolve(process.cwd(), './lib.env')})

let awsConfig = {
    "region": process.env.REGION,
    "endpoint": process.env.ENDPOINT,
    "accessKeyId": process.env.ACCESS_KEY_ID, 
    "secretAccessKey": process.env.SECRET_ACCESS_KEY
}

AWS.config.update(awsConfig);

let docClient = new AWS.DynamoDB.DocumentClient();

function fetchOneByKey(mensa) {
    var params = {
        TableName: "menu",
        Key: {
            "idMensa": mensa
        }
    };
    return new Promise((resolve, reject) => {
        docClient.get(params, function (err, data) {
            if (err) {
                console.log("users::fetchOneByKey::error - " + JSON.stringify(err, null, 2));
                reject(err);
            }
            else {
                console.log("users::fetchOneByKey::success - " + JSON.stringify(data, null, 2));
                resolve(data);
            }
        })
    });
}

module.exports = fetchOneByKey;
        