const Alexa = require('ask-sdk-core');
const readDb = require('./read');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Ciao e benvenuto su Rigatoni Dorati Pisa. Come posso aiutarti?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const AskMenuIntentHandler = {
    canHandle(handlerInput) {
        console.log("requestEnvelope", Alexa.getIntentName(handlerInput.requestEnvelope));
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskMenuIntent';
    },
    async handle(handlerInput) {

        const daysInWeek = 7;
        const specialDaysStart = 100;
        const napTime = 14;
        const today = new Date();

        var canteenSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'canteen');
        var daySlot = Alexa.getSlot(handlerInput.requestEnvelope, 'day');
        var mealSlot = Alexa.getSlot(handlerInput.requestEnvelope, 'meal');
        var canteenRes = canteenSlot.resolutions.resolutionsPerAuthority;
        var canteenValue = canteenRes[0].values[0].value.name;

        var mealType;
        var dayDiff;
        var speakOutput = " ";

        var requestInfo = {
            canteen: canteenValue
        };

        if (mealSlot.resolutions === undefined) {
            let hoursToday = today.getHours();  
            console.log(hoursToday);    
            if (hoursToday >= napTime)  
                mealType = "dinner";
            else
                mealType = "launch";

            speakOutput += "A " + ((mealType == "launch") ? "pranzo " : "cena ");
            
            requestInfo = { 
                ...requestInfo,
                mealSlot: "missing",
                mealType 
            };

        } else {
            var mealRes = mealSlot.resolutions.resolutionsPerAuthority;
            var mealType = mealRes[0].values[0].value.id;
            console.log("mealType", mealType);
            requestInfo = { 
                ...requestInfo,
                mealSlot: "provided",
                mealType 
            };
        }

        if (daySlot.resolutions === undefined) {
            dayDiff = 0;
            requestInfo = { 
                ...requestInfo,
                daySlot: "missing",
                dayDiff 
            };
            speakOutput += " oggi ";
        } else {
            var dayRes = daySlot.resolutions.resolutionsPerAuthority;
            var dayValue = dayRes[0].values[0].value.id;
            console.log("dayValue", dayValue);
            
            if (dayValue >= specialDaysStart) {
                dayDiff = dayValue - specialDaysStart; 
            } else{    
                dayDiff = dayValue - today.getDay();
                if (dayValue < today.getDay()) dayDiff += daysInWeek; 
            }

            requestInfo = { 
                ...requestInfo,
                daySlot: "provided",
                dayValue,
                today,
                dayDiff 
            };
        }
    

        var queryDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        queryDate.setDate(today.getDate() + parseInt(dayDiff));
        queryDate.setMinutes(queryDate.getMinutes() - queryDate.getTimezoneOffset());
        console.log(queryDate);

        requestInfo = {
            ...requestInfo,
            queryDate: queryDate.toISOString()
        };

        var data = await readDb(canteenValue);

        if (data.Item.menu[queryDate.toISOString()] === undefined) {
            speakOutput = "Mi dispiace, il menù per la prossima settimana non è disponibile.";
            requestInfo.menuDBFound = false;
        } else {
            console.log(data.Item.menu[queryDate.toISOString()][mealType]);
            speakOutput += "c'è: " + data.Item.menu[queryDate.toISOString()][mealType];
            requestInfo.menuDBFound = true;
        }

        console.log("requestInfo", requestInfo);
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt("Hai bisogno di altro?")
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent');
    },
    handle(handlerInput) {
        const speakOutput = "Ciao e buon appetito!";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true);
    }
};

const YesIntenHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .addDelegateDirective({
                name: 'AskMenuIntent',
                confirmationStatus: 'NONE',
                slots: {}
            })
            .getResponse();      
    }
}

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = "Ciao, prova a chiedermi cosa c'é oggi alla Martiri!";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
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
        HelpIntentHandler,
        SessionEndedRequestHandler,
        YesIntenHandler,
        AskMenuIntentHandler)
    .lambda();








