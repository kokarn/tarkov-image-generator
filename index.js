#!/usr/bin/env node

const { initializeImageGenerator, generateImages } = require('./generate');

(async () => {
    await initializeImageGenerator();
    await generateImages(process.argv[2], process.argv[3]);
})();
