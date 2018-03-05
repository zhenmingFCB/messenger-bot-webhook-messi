// Author: yunfeisi


'use strict';
// Imports dependencies and set up http server
const
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;


// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Get the webhook event. entry.messaging is an array, but
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {

  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "ffasfe32137jgsdfe323sd";

  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {

    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response;

  // Test app events: log all messaging replies as Purchase
  logPurchaseEvent(sender_psid);

  // Checks if the message contains text
  if (received_message.text) {
    // Create the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    response = {
      "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
    }
  } else if (received_message.attachments) {
    // Get the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "Buy Now",
                "payload": "purchase",
              }
            ],
          }]
        }
      }
    }
  }

  // Sends the response message
  callSendAPI(sender_psid, response);

}

function handlePostback(sender_psid, received_postback) {
  let response;

  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'get_started_payload') {
    response = { "text": "Let's get started!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, you don't like it." }
    logCustomEventDontWant(sender_psid);
  } else if (payload === 'purchase') {
    logPurchaseEvent(sender_psid);
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  });

}

// fb_mobile_purchase App Event
function logPurchaseEvent(sender_psid) {
    request.post({
      url : "https://graph.facebook.com/402697466845782/activities",
      form: {
        event: 'CUSTOM_APP_EVENTS',
        custom_events: JSON.stringify([{
          _eventName: "fb_mobile_purchase",
          _valueToSum: 1,
          fb_currency: 'USD'
        }]),
        advertiser_tracking_enabled: 1,
        application_tracking_enabled: 1,
        extinfo: JSON.stringify(['mb1']),
        page_id: 929341347224972,
        page_scoped_user_id: sender_psid
      }
    }, (err,httpResponse,body) => {
      if (!err) {
        console.log('purchase event logged.');
      } else {
        console.error(err);
        console.log(httpResponse.statusCode);
        console.log(body);
      }
    });
}


// fb_mobile_purchase App Event
function logCustomEventDontWant(sender_psid) {
    request.post({
      url : "https://graph.facebook.com/402697466845782/activities",
      form: {
        event: 'CUSTOM_APP_EVENTS',
        custom_events: JSON.stringify([{
          _eventName: "custom_dont_want_purchase",
        }]),
        advertiser_tracking_enabled: 1,
        application_tracking_enabled: 1,
        extinfo: JSON.stringify(['mb1']),
        page_id: 929341347224972,
        page_scoped_user_id: sender_psid
      }
    }, (err,httpResponse,body) => {
      if (!err) {
        console.log('Custom event dont_want_purchase logged.');
      } else {
        console.error(err);
        console.log(httpResponse.statusCode);
        console.log(body);
      }
    });
}
