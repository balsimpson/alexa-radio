const verifier = require('alexa-verifier');

const db = require('lib')({ token: process.env.STDLIB_SECRET_TOKEN }).utils.kv;

// Global variable of collection
let user_url = '';

class AlexaResponses {
  constructor() {
    this.version = "1.0";
    this.sessionAttributes = {};
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

  getResponse() {
    return this;
  }
}

class Collection {
  constructor(data) {
    this.list = data.list || [];
    this.resume = data.resume || {};
    this.settings = data.settings || this.defaultSettings();
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
        ]
      }
    }

    return default_settings;
  }

  get(query = '') {
    let channelSearch = fuzzy(this.list, 'name');
    let [result] = channelSearch(query);

    if (query) {
      if (result) {
        // check progress
        if (result.progress) {
          result = result.progress;
        } else {
          if (result.shuffle) {
            // random item
            result = randomItem(result.items);
          } else {
            // first item
            result = result.items[0];
          }
        }
      } else {
        for (const channel of this.list) {
          let stationSearch = fuzzy(channel.items, 'name');
          [result] = stationSearch(query);
          // return result;
        }
      }
    } else {
      // check resume
      if (this.resume) {
        result = this.resume;
      }
    }

    if (result) {
      result.token = `${result.name}:${result.channel}`;
    }

    return result;
  }

  next(token) {
    let channelSearch = fuzzy(this.list, 'name');
    let [channel] = channelSearch(token.split(':')[1]);
    let item;

    channel.items.map((_item, index) => {
      if (_item.name == token.split(':')[0]) {
        // check shuffle
        if (channel.shuffle) {
          item = randomItem(channel.items);
        } else {
          item = channel.items[index + 1] ? channel.items[index + 1] : channel.items[0];
        }
      }
    })

    return item;
  }

  response(item) {
    let _response = {
      name: item.name,
      channel: item.channel,
      url: item.url,
      token: item.token,
      progress: item.progress,

    }

    return response;
  }
}

const Alexa = new AlexaResponses();

const LaunchRequestIntentHandler = async (requestEnvelope) => {

  // Alexa custom responses
  let now_playing = speech('playing');
  let station = collection.get();

  if (station) {
    Alexa
      .speak(`${now_playing} - ${station.name}, from ${station.channel}.`)
      .play(station.url, station.progress, station.token)
    // save session attributes
    Alexa.sessionAttributes = { token: station };

  } else {
    // If no station found, prompt to add channel
    Alexa.speak(`You don't have any saved channels. Go to the web page to add a channel.`);
  }

  return Alexa;
}

const IntentRequestHandler = async (requestEnvelope) => {

  let intent = requestEnvelope.request.intent;
  let intentName = getIntentName(requestEnvelope);

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

    case 'NextIntent':
      response = NextIntentHandler(requestEnvelope);
      break;

    case 'ResumeIntent':
      console.log('ResumeIntent:', intentName);
      response = ResumeIntentHandler(requestEnvelope);
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

    let now_playing = speech('playing');

    let slot = getSlotValues(requestEnvelope);
    console.log('PlayRadioIntentHandler search term:', slot.station);

    let station = collection.get(slot.station);

    if (station) {
      Alexa
        .speak(`${now_playing} - ${station.name}, from ${station.channel}.`)
        .play(station.url, station.progress, station.token)
    } else {
      Alexa
        .speak(`Sorry, ${slot.station} was not found`);
    }


    Alexa.sessionAttributes = { token: station };
    return Alexa;

  } catch (error) {
    let slot = getSlotValues(requestEnvelope);
    Alexa.speak(`Sorry, I couldn't find ${slot.station} in your collection`);
    return Alexa;
  }
}

const StopIntentHandler = (requestEnvelope) => {

  let stop_playing = speech('stop');

  Alexa
    .speak(stop_playing)
    .stop();

  return Alexa;
}

const NextIntentHandler = async (requestEnvelope) => {

  console.log('NextIntentHandler:');
  let response = {};
  // let next_playing = speech('next');
  try {
    let token = requestEnvelope.context.AudioPlayer.token;

    if (collection && collection.list) {
      if (token) {
        let current_station = token.split(':')[0] || '';
        let current_channel = token.split(':')[1] || '';

        let getChannel = fuzzy(collection.list, 'name');
        let channel = getChannel(current_channel);

        let station;

        if (channel.length > 0) {
          station = pickStation(channel[0], 'next', current_station);
          response = stationResponse(station, 'next up is ');
        } else {
          console.log('no channels:');
          Alexa.speak(`Go to the web page to add a channel.`);
        }
        return Alexa;
      } else {
        let station = await getStation();
        if (station) {
          response = stationResponse(station, 'next up is ');
        } else {
          Alexa.speak(`Go to the web page to add a channel.`);
        }
        return Alexa;
      }
    } else {
      Alexa.speak(`Go to the web page to add a channel.`);
      return Alexa;
    }
  } catch (error) {
    console.log('next intent:', error);
  }

  // if (collection.list) {
  //   let getChannel = fuzzy(collection.list, 'name');
  //   let channel = getChannel(current_channel);

  //   if (channel.length) {

  //   } else {
  //     channel = randomItem(collection.list);
  //     station = randomItem(channel.items);
  //     station.channel = channel.name;
  //     response = stationResponse(station, next_playing);
  //   }
  // } else {

  // }

}

const ResumeIntentHandler = async (requestEnvelope) => {

  console.log('ResumeIntentHandler:');
  let response = {};
  // let next_playing = speech('next');
  try {

    let channel;
    let station;

    if (collection && collection.list) {
      if (collection && collection.resume && collection.resume.name) {
        station = collection.resume;
        response = stationResponse(station, 'resuming ');
        console.log('res:', response);
      } // No resume
      else {
        channel = randomItem(collection.list);
        station = pickStation(channel);
        station.channel = channel.name;
        response = stationResponse(station, 'now playing ');
      }
    } else {
      response = Alexa.speak("You don't have any saved channels. Go to the web page to add a channel.");
    }
    return Alexa.getResponse(response);

  } catch (error) {
    console.log('resume intent:', error);
  }

}

const HelpIntentHandler = () => {
  let response = {};
  let help_playing = speech('help');

  response.speak = Alexa.speak(help_playing);
  response.prompt = Alexa.prompt('What channel or station do you want to play?');
  return Alexa.getResponse(response);
}

const SessionEndedRequestHandler = (requestEnvelope) => {

  if (requestEnvelope.request.error) {
    console.log('SessionEndedRequest:', requestEnvelope.request.error);
  } else {
    console.log('SessionEnded:');
  }
  return Alexa.getResponse();
}

const ErrorHandler = () => {
  let error_playing = speech('error');

  Alexa.speak(error_playing);
  Alexa.prompt('What channel or station do you want to play?');
  return Alexa;
}

const AudioPlayerEventHandler = async (requestEnvelope) => {
  // Get collection;
  const audioPlayerEventName = requestEnvelope.request.type.split(".")[1];

  let response = {};
  let token = requestEnvelope.request.token;
  let offset = requestEnvelope.request.offsetInMilliseconds;

  switch (audioPlayerEventName) {
    case "PlaybackStarted":
      await updateCollection(token, offset, 'streamable');
      break;
    case "PlaybackFinished":
      console.log("AudioPlayerEventHandler -> PlaybackFinished", token);
      break;
    case "PlaybackStopped":
      await updateCollection(token, offset, 'streamable');
      break;
    case "PlaybackNearlyFinished": {

      let current_station = token.split(':')[0];
      let current_channel = token.split(':')[1];

      let getChannel = fuzzy(collection.list, 'name');
      let channel = getChannel(current_channel);

      let station;

      if (channel.length) {
        station = pickStation(channel[0], 'next', current_station);
        console.log("PlaybackNearlyFinished -> queing up:", station.name);
      }

      if (station) {
        station.token = `${station.name}:${station.channel}`;
        response.audioPlay = Alexa.audioHandler.queue(station.url, station.progress, station.token, token);

      } else {
        console.log("AudioPlayerEventHandler -> PlaybackNearlyFinished - ", token + ": Next station not found");
      }

      break;
    }
    case "PlaybackFailed":
      console.log(`PlaybackFailed - ${requestEnvelope.request.token} - error: ${requestEnvelope.request.error.message}`);
      response.audioPlay = Alexa.audioHandler.play(`${user_url}assets?asset=failed`, 0, 'error');
      await updateCollection(token, offset, 'failed');
      break;
  }

  // console.log('AudioResponse', response);
  return Alexa.getResponse(response);
}

const getStation = async (query, collectionObj) => {
  try {

    let channel;
    let station;

    if (collectionObj && collectionObj.list) {
      if (query) {

        let searchByChannel = fuzzy(collectionObj.list, 'name');
        channel = searchByChannel(query);

        if (channel.length) {
          station = pickStation(channel[0]);
          station.channel = channel[0].name;
        } else {
          station = searchByStation(query);
        }

        return station;

      } else {

        // check collectionObj.resume
        if (collectionObj && collectionObj.resume && collectionObj.resume.name) {
          station = collectionObj.resume;
        } // No resume
        else {
          channel = randomItem(collectionObj.list);
          station = pickStation(channel);
          station.channel = channel.name;
        }

        return station;
      }
    } else {
      return station;
    }

    function searchByStation(query) {
      let found_stations = [];
      collection.list.map(channel => {
        let searchStation = fuzzy(channel.items, 'name');
        let station = searchStation(query);

        if (station.length) {
          station[0].channel = channel.name;
          found_stations.push(station[0]);
        }

      });
      return found_stations[0];
    }

  } catch (error) {
    console.log('error: getStation - ', error.message);
    return null;
  }
}

function pickStation(channel, type, current_station) {
  try {
    let station;
    if (channel) {
      let other_stations = [];

      if (type == 'next') {

        if (channel.shuffle) {
          for (const key of channel.items) {
            if (key.name != current_station) {
              other_stations.push(key);
            }
          }
          station = randomItem(other_stations);
          station.channel = channel.name;
        } else {

          for (let i = 0; i < channel.items.length; i++) {
            const item = channel.items[i];

            if (item.name == current_station) {
              let next_item = channel.items[i + 1] || '';
              next_item.channel = channel.name;

              if (next_item) {
                station = next_item;
              } else {
                station = channel.items[0];
                station.channel = channel.name;
              }
            }
          }
        }

        return station;
      } else {
        if (channel.progress) {
          station = channel.progress;
          station.channel = channel.name;
          return station;
        } else {
          if (channel.shuffle) {
            station = randomItem(channel.items);
            station.channel = channel.name;
            return station;
          } else {

            station = channel.items[0];
            station.channel = channel.name;
            return station;
          }
        }
      }
    } else {
      return station;
    }

  } catch (error) {
    console.log('error - pickStation - ', error.message);
  }
}

function stationResponse(station, speak) {
  let response = {};
  station.token = `${station.name}:${station.channel}`;
  // check progress
  station.progress = station.progress ? station.progress : 0;
  // set Alexa reply
  response.speak = Alexa.speak(`${speak} - ${station.name}, from ${station.channel}.`);
  // Set station audio directive
  response.audioPlay = Alexa.audioHandler.play(station.url, station.progress, station.token);

  return response;
}

// speech options
function speech(response_type) {

  let response = '';

  try {
    switch (response_type) {
      case 'playing':
        response = randomItem(collection.settings.responses.now_playing);
        response = response ? response : 'Here is ';
        break;
      case 'stop':
        response = randomItem(collection.settings.responses.stop_playing);
        response = response ? response : 'Goodbye!';
        break;
      case 'next':
        response = randomItem(collection.settings.responses.next_playing);
        response = response ? response : 'Next up is - ';
        break;
      case 'help':
        break;
      case 'error':
        response = randomItem(collection.settings.responses.error_playing);
        response = response ? response : 'Sorry, something went wrong.';
        break;

      default:
        response = '';
        break;
    }

  } catch (error) {
    response = '';
  }

  return response;
}

// updateCollection
async function updateCollection(token, offset = 0, status) {

  let current_station = token.split(':')[0];
  let current_channel = token.split(':')[1];
  console.log("TCL: updateCollection -> current_station", current_station, current_channel);

  collection = await db.get({
    key: 'channels'
  });

  for (let i = 0; i < collection.list.length; i++) {
    const channel = collection.list[i];

    if (channel.name == current_channel) {
      for (let j = 0; j < channel.items.length; j++) {
        const station = channel.items[j];
        if (station.name == current_station) {
          station.status = status;
          station.progress = offset;
          station.channel = channel.name;
          channel.progress = station;
          collection.resume = station;
        }
      }
    }
  }

  let response = await db.set({
    key: 'channels',
    value: collection
  });

  console.log('updated database:', response);

}

const getIntentName = (requestEnvelope) => {

  let intentName = requestEnvelope.request.intent.name || '';

  if (intentName) {
    intentName = intentName.split('.')[1];
  }

  return intentName;

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
          slot_values[name] = slots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id;
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

module.exports = async (context) => {

  try {

    await verifier(
      context.http.headers.signaturecertchainurl,
      context.http.headers.signature,
      context.http.body
    )

    user_url = getUserURL(context);

    // get saved data
    let db = await db.get({
      key: 'channels'
    });

    const collection = new Collection(db);

    let requestEnvelope = context.params;
    let requestType = requestEnvelope.request.type;
    let intent = requestEnvelope.request.intent || {};
    console.log("intent", intent);

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
    // console.log("response", response);
    return response;

  } catch (error) {
    console.log('Error:', error);
    let response = ErrorHandler(context.params);
    return response;
  }

};