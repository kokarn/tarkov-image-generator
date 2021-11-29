#!/usr/bin/env node

const generateImages = require('./index');

(async () => {
    await generateImages(process.argv[2], process.argv[3]);
})();
