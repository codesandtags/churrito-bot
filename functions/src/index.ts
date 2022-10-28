require('dotenv').config();

const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const dbRef = admin.firestore().doc('tokens/demo');

const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID,
    clientSecret: process.env.TWITTER_CLIENT_SECRET
});

const callbackURL = 'http://127.0.0.1:5000/churrito-bot/us-central1/callback';

// OpenAI API init
// const { Configuration, OpenAIApi } = require('openai');
// const configuration = new Configuration({
//     organization: process.env.OPENAI_ORGANIZATION,
//     apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(configuration);

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

console.log(' 🤖 Open AI configured');

// STEP 1 - Auth URL
exports.auth = functions.https.onRequest(async (request: any, response: any) => {
    console.info(' 🔑 Requesting Authorization from twitter.');
    const { url, codeVerifier, state } = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
    );

    // store verifier
    await dbRef.set({ codeVerifier, state });

    response.redirect(url);
});

// STEP 2
exports.callback = functions.https.onRequest(async (request: any, response: any) => {
    console.info(' 👮‍♀️ Giving autorization on callback.');
    const { state, code } = request.query;

    const dbSnapshot = await dbRef.get();
    console.log({
        data: dbSnapshot.data()
    });

    const { codeVerifier, state: storedState } = dbSnapshot.data();

    if (state !== storedState) {
        return response.status(400).send('Stored tokens do not match!');
    }

    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({ accessToken, refreshToken });

    const { data } = await loggedClient.v2.me(); // start using the client if you want

    response.send(data);

});

// STEP 3
exports.tweet = functions.https.onRequest(async (request: any, response: any) => {
    console.info(' 💌 creating a new tweet.');
    const { refreshToken } = (await dbRef.get()).data();

    const {
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({
        accessToken,
        refreshToken: newRefreshToken
    });

    // const nextTweet = 'Today is a great day to finish something cool!';
    console.info(' 🤖 Getting OpenAI Davinci text.');
    const nextTweet = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: "the hint of the day for javascript",
        max_tokens: 70
    });
    console.log({
        'The tweet is: ': nextTweet.data,
    })
    const { data } = await refreshedClient.v2.tweet(nextTweet.data.choices[0].text);

    response.send(data);
});

// Does not work: https://twitter.com/i/oauth2/authorize?response_type=code&client_id=NVd5Y00tQ211dE1qMVRlOUdTX3Q6MTpjaQ&redirect_uri=http%3A%2F%2F127.0.0.1%3A5000%2Fchurrito-bot%2Fus-central1%2Fcallback&state=4XnC.-lHXu_i2z6BL..jrjU0_aGcpdSB&code_challenge=Nj7oGtBnSksBKY_gF-gUWqGYzfvIGiY1E2pHOtLQbsY&code_challenge_method=s256&scope=tweet.read%20tweet.write%20users.read%20offline.access
// Works:         https://twitter.com/i/oauth2/authorize?response_type=code&client_id=NVd5Y00tQ211dE1qMVRlOUdTX3Q6MTpjaQ&redirect_uri=https://www.example.com&scope=tweet.read%20users.read%20follows.read%20follows.write&state=state&code_challenge=challenge&code_challenge_method=plain
// Works:         https://twitter.com/i/oauth2/authorize?response_type=code&client_id=NVd5Y00tQ211dE1qMVRlOUdTX3Q6MTpjaQ&redirect_uri=https://www.example.com&scope=tweet.read%20users.read%20follows.read%20follows.write&state=state&code_challenge=challenge&code_challenge_method=plain

exports.tweetHourly = functions.pubsub
.schedule('every 2 minutes')
.onRun((context: any) => {
    console.log('This will be run every 5 minutes!', context);
    
    return null;
});