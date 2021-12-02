#!/usr/bin/env node

const { generateImages } = require('./generate');

(async () => {
    await generateImages(process.argv[2], process.argv[3]);
})();
