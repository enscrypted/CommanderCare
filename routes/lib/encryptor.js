const cryptoJS = require('crypto-js');
const aes = require('crypto-js/aes');

function aesEncrypt(input) {
  var iv =  cryptoJS.lib.WordArray.random(128 / 8);
  return iv.toString(cryptoJS.enc.Hex) +  aes.encrypt(input, process.env.AES_KEY, {iv: iv }).toString();
}

function aesDecrypt(input) {
  var iv = input.substring(0,32);
  var input = input.substring(32);
  return aes.decrypt(input, process.env.AES_KEY, {iv: iv}).toString(cryptoJS.enc.Utf8);
}

module.exports = {aesEncrypt, aesDecrypt};