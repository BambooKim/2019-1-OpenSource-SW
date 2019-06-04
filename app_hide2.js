require("dotenv").config({path : 'config.env'});

var express = require('express');
var app = express();
var fs = require("fs");

// API들
//
// line api
const line = require('@line/bot-sdk');
// papago api
var request = require('request');
// google speech-to-text api
//const Speech = require('@google-cloud/speech');
//const speech = new Speech.speechClient();
// 번역 api_url
var translate_api_url = process.env.translate_api_url;
// 언어감지 api_url
var languagedetect_api_url = process.env.languagedetect_api_url

// Naver Auth Key
// 새로 발급받은 naver papago api id, pw 입력
// 보안을 위해 .env 파일에 분리.
var papago_client_id = process.env.client_id;
var papago_client_secret = process.env.client_secret;

const line_config = {
  channelAccessToken: process.env.channelAccessToken,
  channelSecret: process.env.channelSecret,
};

// create LINE SDK client
const line_client = new line.Client(line_config);


var check = 0;
var buf;



// create Express app
// about Express itself: https://expressjs.com/

// register a webhook handler with middleware
// about the middleware, please refer to doc
app.post('/webhook', line.middleware(line_config), (req, res) => {
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
  if (event.type !== 'message') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  // Message Type이 'text'일 때
  if (event.message.type === 'text') {
    console.log("Message Id : ", event.message.id);
    console.log("Message Type : ", event.message.type);
    console.log("Message Text : ", event.message.text);
    return new Promise(function(resolve, reject) {
      //언어 감지 option
      var detect_options = {
        url : languagedetect_api_url,
        form : {'query': event.message.text},
        headers: {'X-Naver-Client-Id': papago_client_id, 'X-Naver-Client-Secret': papago_client_secret}
      };
  
      //papago 언어 감지
      request.post(detect_options,function(error,response,body){
        console.log("Status : ", response.statusCode);
        if(!error && response.statusCode == 200){
          var detect_body = JSON.parse(response.body);
          var source = '';
          var target = '';
          var result = { type: 'text', text:''};
  
          //언어 감지가 제대로 됐는지 확인
          console.log("Detected Language : ", detect_body.langCode);
  
          // 영어, 일본어, 중국어 입력 시 한국어로 번역.
          if(detect_body.langCode == "en" || detect_body.langCode == "ja" || detect_body.langCode == "zh-cn") {
            source = detect_body.langCode;
            target = 'ko';
  
            //papago 번역 option
            var options = {
              url:  translate_api_url,
              
              // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
              form: {'source':source, 'target':target, 'text':event.message.text},
              headers: {'X-Naver-Client-Id': papago_client_id, 'X-Naver-Client-Secret': papago_client_secret}
            };
  
            // Naver Post API
            request.post(options, function(error, response, body) {
              // Translate API Sucess
              if(!error && response.statusCode == 200){
                  // JSON
                  var objBody = JSON.parse(response.body);
                  
                  // Message 잘 찍히는지 확인
                  result.text = objBody.message.result.translatedText;
                  console.log(result.text);
                  
                  //번역된 문장 보내기
                  line_client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
              }
            });
          }

          // 한국어 입력 시 영어로 번역.
          else if (detect_body.langCode == 'ko') { 
            result.text='번역할 언어를 선택해 주세요.\n1. 영어\n2. 일본어\n3. 중국어';
            line_client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
            check = 1;
            buf = event.message.text;
          }
  
          // 메시지의 언어를 파파고에서 지원하지 않는 경우.
          else {
            if(check == 1)
            {
              check = 0;
              source='ko'
              switch(event.message.text)
              {
                case '1':
                  target = 'en';
                  break;
                case '2':
                  target = 'ja';
                  break;
                case '3':
                  target = 'zh-CN';
                  break;
                default:
                  break;
              }
              //papago 번역 option
              var options = {
              url:  translate_api_url,
              
              // 한국어(source : ko), 영어(target: en), 카톡에서 받는 메시지(text)
              form: {'source':source, 'target':target, 'text':buf},
              headers: {'X-Naver-Client-Id': papago_client_id, 'X-Naver-Client-Secret': papago_client_secret}
              };
  
              // Naver Post API
              request.post(options, function(error, response, body) {
              // Translate API Sucess
              if(!error && response.statusCode == 200){
                  // JSON
                  var objBody = JSON.parse(response.body);
                  
                  // Message 잘 찍히는지 확인
                  result.text = objBody.message.result.translatedText;
                  console.log(result.text);
                  
                  //번역된 문장 보내기
                  line_client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
                }
              });

            }
            else 
            {
              result.text = '언어를 감지할 수 없습니다. \n 지원되지 않는 언어입니다.';
              line_client.replyMessage(event.replyToken,result).then(resolve).catch(reject);
            }
          }
        }
      });
    });
  } 
  
  // Message Type이 audio일 때
  else if (event.message.type === 'audio'){     
    console.log("Message Type : ", event.message.type);
    console.log("Provider Type : ", event.message.contentProvider.type);
    console.log("Message Id : ", event.message.id);

    line_client.getMessageContent(event.message.id)
    .then((stream) => {
      stream.on("data", (chunk) => {
        fs.writeFileSync("./resources/hello.wav", chunk, (err) => {
          if(err) throw err;
        })
      })
      stream.on("error", (err) => {
        console.log(err);
      })
    })
    .then(console.log("Audio File Saved in EC2."));
/*
    const fileName = "./resources/hello.wav";
    const encoding = "LINEAR16";
    const sampleRateHertz = 44100;
    const languageCode = "ko-KR";

    const projectId = "speech-to-text-api-test-242609";
    const speechClient = Speech({
      projectId : projectId
    });

    const config = {
      encoding : encoding,
      sampleRateHertz : sampleRateHertz,
      languageCode : languageCode
    };

    const audio = {
      content : fs.readFileSync(fileName).toString("base64")
    };

    const request = {
      config:config,
      audio:audio
    };

    speech.recognize(request)
    .then((results) => {
      const transcription=results[0].results[0].alternatives[0].transcript;
      console.log('Transcription : ', transcription);
    })
    .catch((err) =>{
      console.error('Error:',err);
    });*/
  }
}

app.listen(80, function () {
  console.log('Linebot listening on port 80!');
});
