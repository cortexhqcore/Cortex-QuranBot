require('pathlra-aliaser')();

const config = {
    development: {
        emoji: {
            group: '<:group:1507452855894802652>',
            change: '<:change:1507454727942832190>',
            sound: '<:sound:1507455928872468661>',
            electric_bolt: '<:electric_bolt:1507456531275321457>',
            build: '<:build:1507457104431284425>',
            globe: '<:globe:1507460002493759559>',
            help: '<:help:1507460586718367745>',
        },
        gif: {
            loading: '<a:loading:1507429386075504792>',
        },
    },

    production: {
        emoji: {
            group: '<:group:1507453432578052157>',
            change: '<:change:1507454756627681281>',
            sound: '<:sound:1507455815743832074>',
            electric_bolt: '<:electric_bolt:1507456516997775440>',
            build: '<:build:1507457122559070278>',
            globe: '<:globe:1507460016263921894>',
            help: '<:help:1507460571425935524>',
        },
        gif: {
            loading: '<a:loading:1507426304708968588>',
        },
    },
}[process.env.NODE_ENV];

module.exports = {
    ...config.emoji,

    emoji: config.emoji,
    gif: config.gif,

    getEmoji: (name) => config.emoji[name],
    getGif: (name) => config.gif[name],
};
