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
            welcome: '<:welcome:1507972882633064488>',
            features: '<:features:1507973474222866553>',
            book: '<:book:1507974074545209495>',
            radio: '<:radio:1507974659742892053>',
            prayer_times: '<:prayer_times:1507975095350591621>',
            crescent_moon: '<:crescent_moon:1507975468501045388>',
            edit: '<:edit:1507976280321036349>',
            hub: '<:hub:1507976696584863904>',
            bulb: '<:bulb:1507977759396331711>',
            offline: '<:offline:1508238291336691742>',
            online: '<:online:1508238289704976515>',
            check: '<:check:1508253364230553661>',
            screenRotation: '<:screenRotation:1508254182208180234>',
            exclamation: '<:exclamation:1508254743955509388>',
            barChart: '<:barChart:1508258436939382857>',
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
            welcome: '<:welcome:1507972865624903710>',
            features: '<:features:1507973488894414980>',
            book: '<:book:1507974056190939196>',
            radio: '<:radio:1507974646887354399>',
            prayer_times: '<:prayer_times:1507975081932881981>',
            crescent_moon: '<:crescent_moon:1507975453598547978>',
            edit: '<:edit:1507976265343434805>',
            hub: '<:hub:1507976682634739792>',
            bulb: '<:bulb:1507977773547782194>',
            offline: '<:offline:1508238272223117415>',
            online: '<:online:1508238250425323741>',
            check: '<:check:1508253391762096218>',
            screenRotation: '<:screenRotation:1508254200713314435>',
            exclamation: '<:exclamation:1508254767401402442>',
            barChart: '<:barChart:1508258455427878912>',
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
