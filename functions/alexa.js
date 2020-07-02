const verifier = require('alexa-verifier');

const db = require('lib')({ token: process.env.STDLIB_SECRET_TOKEN }).utils.kv;

// Global variable of collection
let user_url = '';

class AlexaResponses {
  constructor() {
    this.version = "1.0";
    this.response = {};
  }

  speak(speech) {
    this.response.outputSpeech = {
      "type": "SSML",
      "ssml": `<speak>${speech}</speak>`
    }

    return this;
  }

  prompt(speech) {
    this.response.reprompt = {
      outputSpeech: {
        "type": "SSML",
        "ssml": `<speak>${speech}</speak>`
      }
    }

    return this;
  }

  card(title, content = '', image_url = '') {
    this.response.card = {
      "type": "Standard",
      "title": `${title}`,
      "content": `${content}`,
      "text": `${content}`,
      "image": {
        "smallImageUrl": `${image_url}`,
        "largeImageUrl": `${image_url}`
      }
    }
    return this;
  }

  play(user_url, url, offset = 0, token) {

    let station;
    let channel;

    if (token) {
      station = token.split(':')[0];
      channel = token.split(':')[1];
    } else {
      token = " "
    }

    this.response.directives = [
      {
        "type": "AudioPlayer.Play",
        "playBehavior": "REPLACE_ALL",
        "audioItem": {
          "stream": {
            "url": `${url}`,
            "token": token,
            "offsetInMilliseconds": `${offset}`
          },
          "metadata": {
            "title": station,
            "subtitle": channel,
            "art": {
              "sources": [
                {
                  "url": `${user_url}assets?asset=station`
                }
              ]
            },
            "backgroundImage": {
              "sources": [
                {
                  "url": `${user_url}assets?asset=background`
                }
              ]
            }
          }
        }
      }
    ]

    return this;
  }

  stop() {
    this.response.directives = [
      {
        "type": "AudioPlayer.Stop"
      }
    ]
    this.response.shouldEndSession = true;
    return this;
  }

  queue(user_url, url, offset, token, previous_token) {
    let station;
    let channel;

    if (token) {
      station = token.split(':')[0];
      channel = token.split(':')[1];
    } else {
      token = " "
    }

    if (offset == undefined) {
      offset = 0
    }

    if (previous_token == undefined) {
      previous_token = token
    }

    this.response.directives = [
      {
        "type": "AudioPlayer.Play",
        "playBehavior": "ENQUEUE",
        "audioItem": {
          "stream": {
            "url": url,
            "token": token,
            "expectedPreviousToken": previous_token,
            "offsetInMilliseconds": offset
          },
          "metadata": {
            "title": station,
            "subtitle": channel,
            "art": {
              "sources": [
                {
                  "url": `${user_url}assets?asset=station`
                }
              ]
            },
            "backgroundImage": {
              "sources": [
                {
                  "url": `${user_url}assets?asset=background`
                }
              ]
            }
          }
        }
      }
    ]

    return this;
  }
}

class Collection {
  constructor() {
    this.list = [];
    this.resume = {};
    this.settings = this.defaultSettings();
  }

  defaultSettings() {
    let default_settings = {
      responses: {
        now_playing: [
          'This is'
        ],
        help_playing: [
          'Tell me a station name to play'
        ],
        next_playing: [
          'Next up is'
        ],
        stop_playing: [
          'Goodbye'
        ],
        error_playing: [
          'Somethng went wrong'
        ],
        no_data: [
          "You don't have any saved channels. Go to web page to add a channel."
        ]
      }
    }

    return default_settings;
  }

  load(data) {
    if (data) {
      this.list = data.list || [];
      this.resume = data.resume || {};
      if (data.settings.responses !== undefined) {
        this.settings = data.settings;
      } else {
        this.settings = this.defaultSettings();
      }
    } else {
      this.list = [];
      this.resume = {};
      this.settings = this.defaultSettings();
    }
    return this;
  }

  get(query = '') {

    let result;
    let channel_name;
    // if there is at least one channel
    if (this.list.length > 0) {
      let channelSearch = fuzzy(this.list, 'name');
      [result] = channelSearch(query);
      // channel search
      if (query && result) {
        channel_name = result.name;
        // check progress
        if (result.progress) {
          result = result.progress;
        } else {
          if (result.shuffle) {
            // random item
            result = randomItem(result.items);
            result.channel = result.name;
          } else {
            // first item
            result = result.items[0];
          }
        }

        if (result.name) {
          result.channel = channel_name || '';
          result.token = `${result.name}:${result.channel}`;
        }

        return result;
      }
      // station search
      else {
        for (const channel of this.list) {
          let stationSearch = fuzzy(channel.items, 'name');
          [result] = stationSearch(query);

          if (result !== undefined) {
            result.channel = channel.name;
            result.token = `${result.name}:${result.channel}`;
            break;
          }
        }

      }

      if (result === undefined) {
        // console.log(result);
        result = 'not found'
      }

    } else {
      // no saved channels
      result = 'no data'
      console.log('no saved data');

    }

    return result;
  }

  update(token, offset, status) {
    let token_station = token.split(':')[0];
    let token_channel = token.split(':')[1];
    let station = this.get(token_station);

    station.progress = offset;
    station.status = status;

    this.resume = station;

    return this;
  }

  next(token) {

    let item;
    if (token) {
      let channelSearch = fuzzy(this.list, 'name');
      let [channel] = channelSearch(token.split(':')[1]);

      if (channel) {
        channel.items.map((_item, index) => {
          if (_item.name == token.split(':')[0]) {
            // check shuffle
            if (channel.shuffle) {
              item = randomItem(channel.items);
            } else {
              item = channel.items[index + 1];
            }
          }
        })

        if (item) {
          item.channel = channel.name;
        }
      }

    }

    console.log('item:', item);
    return item;
  }

  response(type) {
    let res = '';

    switch (type) {
      case 'playing':
        res = randomItem(this.settings.responses.now_playing);
        res = res ? res : 'Here is ';
        break;
      case 'stop':
        res = randomItem(this.settings.responses.stop_playing);
        res = res ? res : 'Goodbye!';
        break;
      case 'next':
        res = randomItem(this.settings.responses.next_playing);
        res = res ? res : 'Next up is - ';
        break;
      case 'help':
        res = randomItem(this.settings.responses.help_playing);
        // console.log(this.settings.responses);
        break;
      case 'error':
        res = randomItem(this.settings.responses.error_playing);
        res = res ? res : 'Sorry, something went wrong.';
        break;
      case 'nodata':
        res = randomItem(this.settings.responses.no_data);
        res = res ? res : "You don't have any saved channels. Go to web page to add a channel.";
        break;
      default:
        res = 'Thousand apologies, something went wrong.';
        break;
    }

    return res;
  }

  // save object data
  data() {
    return {
      list: this.list,
      resume: this.resume,
      settings: this.settings
    }
  }
}

// HELPERS //
const fuzzy = (items, key) => {
  return (query) => {
    query = query.replace(/\'|!|\?/gim, '')
    let words = query.toLowerCase().split(' ');
    return items.filter((item) => {
      let normalizedTerm = item[key].toLowerCase();
      normalizedTerm = normalizedTerm.replace(/\'|!|\?/gim, '');
      return words.every((word) => {
        return (normalizedTerm.indexOf(word) > -1);
      });
    });
  };
};

// Pick a random item from an array
const randomItem = (arrayOfItems) => {

  try {
    let type = typeof arrayOfItems;

    let iLen = arrayOfItems.length;
    let key = 0;
    let keys;

    if (type === 'object') {
      keys = Object.keys(arrayOfItems);
      iLen = keys.length;
    }

    key = Math.floor(Math.random() * iLen);

    let rand_item = arrayOfItems[keys[key]];
    rand_item.index = key;
    return rand_item;
  } catch (error) {
    console.log('random item:', error.message);
    return '';
  }

};

function getUserURL(context) {
  let identifier = context.service.identifier;
  let user = identifier.split('.')[0];
  let service = identifier.split('.')[1].replace(/\[|\]/gmi, '');

  return `https://${user}.api.stdlib.com/${service}/`;
}
// Save data to local storage or elsewehere
async function saveData(savedData) {
  await db.set({
    key: 'channels',
    value: savedData
  });
}
// HELPERS END //

const LaunchRequestIntentHandler = async (requestEnvelope) => {

  // Alexa custom responses
  let now_playing = collection.response('playing');
  let station = collection.get();

  if (station.name) {
    Alexa
      .speak(`${now_playing} - ${station.name}, from ${station.channel}.`)
      .card(station.name, station.channel, `${user_url}assets?asset=background`)
      .play(user_url, station.url, station.progress, station.token)
    // save session attributes
    Alexa.sessionAttributes = { token: station };

  } else {
    // If no station found, prompt to add channel
    Alexa.speak(`You don't have any saved channels. Go to web page to add a channel.`);
  }

  return Alexa;
}

const IntentRequestHandler = async (requestEnvelope) => {

  let intent = requestEnvelope.request.intent;
  let intentName = intent.name.split('.')[1] || intent.name;

  console.log('intentName:', intentName);
  let response;

  switch (intentName) {
    case 'PlayRadioIntent':
      response = await PlayRadioIntentHandler(requestEnvelope);
      break;

    case 'StopIntent':
      response = StopIntentHandler(requestEnvelope);
      break;

    case 'PauseIntent':
      response = StopIntentHandler(requestEnvelope);
      break;

    case 'CancelIntent':
      response = StopIntentHandler(requestEnvelope);
      break;

    case 'NextIntent':
      response = NextIntentHandler(requestEnvelope);
      break;

    case 'PreviousIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;

    case 'ResumeIntent':
      response = ResumeIntentHandler(requestEnvelope);
      break;

    case 'LoopOffIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;
    case 'LoopOnIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;
    case 'RepeatIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;
    case 'StartOverIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;
    case 'ShuffleOffIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;
    case 'ShuffleOnIntent':
      response = NotSupportedIntentHandler(requestEnvelope);
      break;

    case 'HelpIntent':
      response = HelpIntentHandler(requestEnvelope);
      break;

    default:
      console.log('default:', intentName);
      response = ErrorHandler();
      break;
  }

  return response;
}

const PlayRadioIntentHandler = async (requestEnvelope) => {
  try {
    if (collection.list.length > 0) {

      let now_playing = collection.response('playing');
      let slot = getSlotValues(requestEnvelope);
      let station = collection.get(slot.station);

      if (station.name) {
        Alexa.sessionAttributes = { token: station };
        Alexa
          .speak(`${now_playing} ${station.name} from ${station.channel}.`)
          .play(user_url, station.url, station.progress, station.token)
      } else if (station === 'not found') {
        Alexa
          .speak(`Sorry, ${slot.station} was not found`);
      } else {
        Alexa.speak(collection.response('nodata'));
      }
      return Alexa;
    } else {
      Alexa.speak(collection.response('nodata'));
      return Alexa;
    }

  } catch (error) {
    console.log('PlayRadioIntentHandler:Error - ', error);
    Alexa.speak('error: ' + error.message);
    return Alexa;
  }
}

const StopIntentHandler = (requestEnvelope) => {

  Alexa
    .speak(collection.response('stop'))
    .stop();

  return Alexa;
}

const NextIntentHandler = async (requestEnvelope) => {

  // let next_playing = speech('next');
  try {
    let token = requestEnvelope.context.AudioPlayer.token;
    let next_item = collection.next(token);

    if (next_item) {
      Alexa
        .speak(`Next up is ${next_item.name}`)
        .play(user_url, next_item.url, next_item.progress, next_item.token);
    } else {
      Alexa
        .speak(`There is nothing to play next.`);
    }
    console.log('nextIntentHandler :', JSON.stringify(Alexa));
    return Alexa;

  } catch (error) {
    console.log('nextError:', error);
    Alexa
      .speak(`Something went wrong playing the next track.`);

    return Alexa;
  }
}

const ResumeIntentHandler = async (requestEnvelope) => {

  if (collection.resume) {
    let station = collection.resume;
    Alexa
      .speak(`resuming ${station.name}`)
      .play('userurl/', station.url, station.progress, `${station.channel}:${station.name}`);
  } else {
    Alexa.speak('There is nothing to resume.')
  }

  return Alexa;
}

const ShuffleOnIntentHandler = async (requestEnvelope) => {

  if (collection.resume) {
    let station = collection.resume;
    Alexa
      .speak(`resuming ${station.name}`)
      .play('userurl/', station.url, station.progress, `${station.channel}:${station.name}`);
  } else {
    Alexa.speak('There is nothing to resume.')
  }

  return Alexa;
}

const HelpIntentHandler = () => {

  if (collection.list.length > 0) {
    Alexa
      .speak('You can search by channel or station name. Tell me a station or a channel to play.')
      .prompt('What channel or station do you want to play?');
  } else {
    Alexa
      .speak("You don't have any saved channels. Go to web page to add a channel.");
  }

  return Alexa;
}

const SessionEndedRequestHandler = (requestEnvelope) => {

  if (requestEnvelope.request.error) {
    console.log('SessionEndedRequest:', requestEnvelope.request.error);
  } else {
    console.log('SessionEnded:');
  }
  return Alexa;
}

const ErrorHandler = () => {
  Alexa.speak(collection.response('error'));
  return Alexa;
}

const NotSupportedIntentHandler = (requestEnvelope) => {
  let intentName = requestEnvelope.request.intent.name.split('.')[1] || requestEnvelope.request.intent.name;

  Alexa.speak(`${intentName} is not currently supported.`);

  return Alexa;
}


const AudioPlayerEventHandler = async (requestEnvelope) => {
  // Get collection;
  const audioPlayerEventName = requestEnvelope.request.type.split(".")[1];
  console.log('audioPlayerEventName: ', audioPlayerEventName);
  let token = requestEnvelope.request.token;
  let offset = requestEnvelope.request.offsetInMilliseconds;

  switch (audioPlayerEventName) {
    case "PlaybackStarted":
      collection.update(token, offset, 'streamable');
      await saveData(collection.data());
      break;
    case "PlaybackFinished":
      console.log("AudioPlayerEventHandler -> PlaybackFinished", token);
      break;
    case "PlaybackStopped":
      collection.update(token, offset, 'streamable');
      await saveData(collection.data());
      break;
    case "PlaybackNearlyFinished": {
      let station = collection.next(token);
      if (station.name) {
        station.token = `${station.name}:${station.channel}`;
        Alexa.queue(user_url, station.url, station.progress, station.token, token);
      } else {
        console.log("PlaybackNearlyFinished - ", token + ": Next station not found");
      }
      break;
    }
    case "PlaybackFailed":
      console.log(`PlaybackFailed - ${requestEnvelope.request.token} - error: ${requestEnvelope.request.error.message}`);

      Alexa.play(user_url, `${user_url}assets?asset=failed`, 0, 'error');
      collection.update(token, offset, 'failed');
      await saveData(collection.data());
      break;
  }

  // console.log('AudioResponse', response);
  return Alexa;
}

const getSlotValues = (requestEnvelope) => {

  let filled_slots = {
    "duration": {
      "name": "duration",
      "value": "PT10M",
      "confirmationStatus": "NONE",
      "source": "USER"
    },
    "control": {
      "name": "control",
      "value": "skip forward",
      "resolutions": {
        "resolutionsPerAuthority": [
          {
            "authority": "amzn1.er-authority.MEDIA_CONTROL",
            "status": {
              "code": "ER_SUCCESS_MATCH"
            },
            "values": [
              {
                "value": {
                  "name": "forward",
                  "id": "forward"
                }
              }]
          }]
      },
      "confirmationStatus": "NONE", "source": "USER"
    }
  };

  const slot_values = {};
  let slots = requestEnvelope.request.intent.slots;

  // console.log(`filled slots: ${JSON.stringify(slots)}`);
  Object.keys(slots).forEach((item) => {
    const name = slots[item].name;
    // console.log(`name: ${name}`);
    if (slots[item] &&
      slots[item].resolutions &&
      slots[item].resolutions.resolutionsPerAuthority[0] &&
      slots[item].resolutions.resolutionsPerAuthority[0].status &&
      slots[item].resolutions.resolutionsPerAuthority[0].status.code) {
      switch (slots[item].resolutions.resolutionsPerAuthority[0].status.code) {
        case 'ER_SUCCESS_MATCH':
          // slot_values[name] = slots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id;
          slot_values[name] = slots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name;
          break;
        case 'ER_SUCCESS_NO_MATCH':
          slot_values[name] = slots[item].value;
          break;
        default:
          break;
      }
    } else {
      slot_values[name] = slots[item].value;
    }
  });

  return slot_values;
}

let Alexa = new AlexaResponses();
const collection = new Collection();
/**
* Sends an Allexa Response
* @returns {object.http} Object The result
*/
module.exports = async (context) => {

  try {
    await verifier(
      context.http.headers.signaturecertchainurl,
      context.http.headers.signature,
      context.http.body
    )

    Alexa = new AlexaResponses();
    user_url = getUserURL(context);

    // get saved data
    let saved_data = await db.get({
      key: 'channels'
    });

    collection.load(saved_data);

    let requestEnvelope = context.params;
    // console.log("requestEnvelope", requestEnvelope.request);

    if (requestEnvelope.request) {
      let requestType = requestEnvelope.request.type;
      console.log("type", requestEnvelope.request.type);
      // let intent = requestEnvelope.request.intent || {};

      let response = {};

      // console.log("requestType", requestType);
      if (requestType === 'LaunchRequest') {
        response = await LaunchRequestIntentHandler(requestEnvelope);
      } else if (requestType.startsWith("AudioPlayer.")) {
        response = await AudioPlayerEventHandler(requestEnvelope);
      } else if (requestType === 'IntentRequest') {
        response = await IntentRequestHandler(requestEnvelope);
      } else if (requestType === 'SessionEndedRequest') {
        response = SessionEndedRequestHandler(requestEnvelope);
      } else {
        response = ErrorHandler(requestEnvelope);
      }

      // console.log("response", JSON.stringify(response));
      // return response;
      let resObj = {
        statusCode: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(response)
      }

      // console.log('resObj:', resObj);
      return resObj;

    } else {
      let response = ErrorHandler(context.params);

      let resObj = {
        statusCode: 200,
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(response)
      }

      console.log('resObjElse:', JSON.stringify(resObj));
      return resObj;
    }
  } catch (error) {
    let response = ErrorHandler(context.params);
    let resObj = {
      statusCode: 400,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(response)
    }

    console.log('resObjError:', error);
    return resObj;
  }
}