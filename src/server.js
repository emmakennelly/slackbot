import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import dotenv from 'dotenv';
import botkit from 'botkit';

const yelp = require('yelp-fusion');

dotenv.config({ silent: true });

// and then the secret is usable this way:
// initialize
const app = express();
// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

// initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
  // this grabs the slack token we exported earlier
}).startRTM((err) => {
  // start the real time message client
  if (err) { throw new Error(err); }
});


// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});
// enable/disable cross origin resource sharing if necessary
app.use(cors());

// enable/disable http request logging
app.use(morgan('dev'));

// enable only if you want templating
app.set('view engine', 'ejs');

// enable only if you want static assets from folder static
app.use(express.static('static'));

// this just allows us to render ejs from the ../app/views directory
app.set('views', path.join(__dirname, '../src/views'));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);

controller.on('channel_join', (bot, event) => {
  bot.reply('Welcome! If you\'re looking for nearby food options, say \'I\'m hungry\' or just type \'food\'');
});

controller.on('message_received', (bot, message) => {
  bot.reply(message, 'got your message');
});

// example hello response
controller.hears(['sushi'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  const yelpClient = yelp.client(process.env.YELP_CLIENT_SECRET);

  yelpClient.search({
    term: 'Sushi',
    location: 'hanover, nh',
  }).then((response) => {
    console.log(response.jsonBody.businesses[0].name);
    response.jsonBody.businesses.forEach((business) => {
      bot.reply(message, business.name);
    });
  }).catch((e) => {
    console.log(e);
  });
});

controller.hears('help', ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  // this event can be triggered whenever a user needs help
  bot.reply(message, 'Just say \'I\'m hungry\' or just type \'food\' for nearby options!');
});

controller.hears(['I\'m hungry', 'food'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  // start a conversation to handle this response
  bot.startConversation(message, (err, convo) => {
    if (err) console.log(err);
    // start a question
    convo.ask('What kind of food are you in the mood for?', (response) => {
      convo.ask('What is your current location? (City, State)', (loc) => {
        console.log(loc);
        const yelpClient = yelp.client(process.env.YELP_CLIENT_SECRET);
        yelpClient.search({
          term: response.text,
          location: loc.text,
        }).then((res) => {
          console.log(res.jsonBody.businesses[0].name);

          res.jsonBody.businesses.forEach((business) => {
            bot.reply(message, `${business.name} ${business.url}`);
          });
        }).catch((e) => {
          console.log(e);
        });
      });
      convo.next(); // always call this to keep things flowing (check the readme for more info)
    });
  });
});

// controller.on('user_typing', (bot, message) => {
//   bot.reply(message, 'stop typing!');
// });

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});
