var express = require('express');
var app = express();
const line = require('@line/bot-sdk');
require("dotenv").config({path : 'config.env'});

//papago api
var request = require('request');

//번역 api_url
var translate_api_url = process.env.translate_api_url;

//언어감지 api_url
var languagedetect_api_url = process.env.languagedetect_api_url

// Naver Auth Key
// 새로 발급받은 naver papago api id, pw 입력
// 보안을 위해 .env 파일에 분리.
var client_id = process.env.client_id;
var client_secret = process.env.client_secret;

const config = {
  channelAccessToken: process.env.channelAccessToken,
  channelSecret: process.env.channelSecret,
};

// create LINE SDK client
const client = new line.Client(config);

// create Express app
// about Express itself: https://expressjs.com/

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(200).end();
    });
});

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }
  return new Promise(function(resolve, reject) {
    //언어 감지 option
    var detect_options = {
      url : languagedetect_api_url,
      form : {'query': event.message.text},
      headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
    };

    //papago 언어 감지
    request.post(detect_options,function(error,response,body){
      console.log(response.statusCode);
      if(!error && response.statusCode == 200){
        var detect_body = JSON.parse(response.body);
        var source = '';
        var target = '';
        var result = { type: 'text', text:''};

        //언어 감지가 제대로 됐는지 확인
        console.log(detect_body.langCode);

        // 영어, 일본어, 중국어 입력 시 한국어로 번역.
        if(detect_body.langCode == "en" || detect_body.langCode == "ja" || detect_body.langCode == "zh-cn")
        {
          source = detect_body.langCode;
          target = 'ko';

          //papago 번역 option
          var options = {
            url:  translate_api_url,
            // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
            form: {'source':source, 'target':target, 'text':event.message.text},
            headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
          };

          // Naver Post API
          request.post(options, function(error, response, body){
            // Translate API Sucess
            if(!error && response.statusCode == 200){
                // JSON
                var objBody = JSON.parse(response.body);
                // Message 잘 찍히는지 확인

                result.text = objBody.message.result.translatedText;
                console.log(result.text);
                //번역된 문장 보내기
                client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
            }
          });
        }

        // 한국어 입력 시 영어로 번역.
        else if(detect_body.langCode == 'ko'){
          source = 'ko';
          target = 'en';
          //papago 번역 option
          var options = {
              url:  translate_api_url,
              // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
              form: {'source':source, 'target':target, 'text':event.message.text},
              headers: {'X-Naver-Client-Id': client_id, 'X-Naver-Client-Secret': client_secret}
          };

          // Naver Post API
          request.post(options, function(error, response, body){
              // Translate API Sucess
              if(!error && response.statusCode == 200){
                  // JSON
                  var objBody = JSON.parse(response.body);
                  // Message 잘 찍히는지 확인

                  result.text = objBody.message.result.translatedText;
                  console.log(result.text);
                  //번역된 문장 보내기
                  client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
              }
          });
        }
        // 메시지의 언어를 파파고에서 지원하지 않는 경우.
        else{
          result.text = '언어를 감지할 수 없습니다. \n 지원되지 않는 언어입니다.';
          client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
        }

      }

    });

    });
  }

app.listen(80, function () {
  console.log('Linebot listening on port 80!');
});
