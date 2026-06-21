// Adding the rate limit for the credits bcz the no one else can missuse the credits and key

import arcjet, {
    tokenBucket,
    detectPromptInjection,
    sensitiveInfo
} from "@arcjet/next";


export const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    characteristics: ["userId"],
    rules:[
        tokenBucket({
            mode: "LIVE",
            refillRate: 5, // refill 5 tokens every..
            interval: 60, // ...60 seconds
            capacity: 5, // max burst = 5
        }),

        detectPromptInjection({
            mode: "LIVE",
        }),

        sensitiveInfo({
            mode: "LIVE",
            deny: ["CREDIT_CARD_NUMBER", "API_KEY", "AWS_SECRET_KEY"],
        }),
    ]
})