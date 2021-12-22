#!/usr/bin/env node

const { initializeImageGenerator, generateImages, shutdown } = require('./generate');

const testItems = {
    'ak-12 mag': {
  	    id: '5bed61680db834001d2c45ab',
        hash: 129279493,
        type: 'mag'
    },
    'sr1mp mag': {
  	    id: '59f99a7d86f7745b134aa97b',
        hash: -1157986124,
        type: 'mag'
    },
    'stanag': {
        id: '55d4887d4bdc2d962f8b4570',
        hash: -304995614,
        type: 'mag'
    },
    'gpnvg': {
        id: '5c0558060db834001b735271',
        hash: 1444116773,
        type: 'nvg'
    },
    'as val': {
        id: '57c44b372459772d2b39b8ce',
        hash: 658560108,
        type: 'weapon'
    },
    'makarov': {
        id: '5448bd6b4bdc2dfc2f8b4569',
        hash: 430064332,
        type: 'weapon'
    },
    'aks74u': {
        id: '57dc2fa62459775949412633',
        hash: 592229284,
        type: 'weapon'
    }
};

(async () => {
    let targetItemId = false;
    let forceImage = false;
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg == '-id') {
            if (process.argv.length > i+1) {
                targetItemId = process.argv[i+1];
            }
        } else if (arg == '-img' || arg == '-image') {
            if (process.argv.length > i+1) {
                forceImage = process.argv[i+1];
            }
        }
    }
    if (!targetItemId && process.argv[2] && process.argv[2].length == 24) {
        targetItemId = process.argv[2];
    }
    if (!forceImage && process.argv[3] && !isNaN(process.argv[3].length)) {
        forceImage = process.argv[3];
    }
    try {
        console.log(testItems.makarov.hash);
        const hash = await initializeImageGenerator({haltOnHash: '5448bd6b4bdc2dfc2f8b4569'});
        //await generateImages({targetItemId: targetItemId, forceImageIndex: forceImage});
    } catch (error) {
        console.log(error);
    }
    shutdown();
})();
