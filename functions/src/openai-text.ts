require('dotenv').config();

async function getTextCompletion(prompt) {
    const { Configuration, OpenAIApi } = require("openai");

    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    console.log(`🤓 The prompt is: ${prompt}`);
    const response = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: prompt,
        temperature: 0.6,
        max_tokens: 150,
        top_p: 1,
        frequency_penalty: 1,
        presence_penalty: 1,
    });

    console.log({
        ' 🤖 The data generated is: ': response.data.choices
    })
}

getTextCompletion('Tell me about RIC team community');