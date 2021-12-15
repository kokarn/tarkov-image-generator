#!/usr/bin/env node

const { initializeImageGenerator, generateImages } = require('./generate');

(async () => {
    try {
        await initializeImageGenerator();
        await generateImages(process.argv[2], process.argv[3]);
    } catch (error) {
        console.log(error);
    }
})();
