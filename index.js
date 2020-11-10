const Alexa = require('ask-sdk-core');
const readDb = require('./read');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Ciao e benvenuto su DSU Mensa Pisa, come posso aiutarti?';

        return handlerInput.responseBuilder
            .addDelegateDirective({
                name: 'AskMenuIntent',
                confirmationStatus: 'NONE',
                slots: {}
            })
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const AskMenuIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskMenuIntent';
    },
    async handle(handlerInput) {
        const daysInWeek = 7;
        var mensa = Alexa.getSlotValue(handlerInput.requestEnvelope, 'canteen');

        var daySlot = Alexa.getSlot(handlerInput.requestEnvelope, 'day');
        var dayRes = daySlot.resolutions.resolutionsPerAuthority;
        var dayValue = dayRes[0].values[0].value.id;
        console.log("dayValue", dayValue);
      
        var mealSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'meal');
        var mealRes = mealSlot.resolutions.resolutionsPerAuthority;
        var mealType = mealRes[0].values[0].value.id;
        console.log("mealType", mealType);

        const today = new Date();
        var dayDiff = dayValue - today.getDay();

        if (dayValue < today.getDay()) dayDiff += daysInWeek; 

        var queryDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        queryDate.setDate(today.getDate() + parseInt(dayDiff));
        console.log(queryDate);

        var data = await readDb(mensa);

        var speakOutput;

        if (data.Item.menu[queryDate.toISOString()] === undefined) {
            speakOutput = "Mangi a casa.";
        } else {
            console.log(data.Item.menu[queryDate.toISOString()][mealType]);
            speakOutput = data.Item.menu[queryDate.toISOString()][mealType];
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Arrivederci!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Sessione terminata: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        AskMenuIntentHandler)
    .lambda();








