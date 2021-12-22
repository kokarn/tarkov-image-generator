#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const got = require('got');

const Jimp = require('jimp');

const uploadImages = require('./upload-images');
const hashCalc = require('./hash-calculator');

let bsgData = false;
let presets = false;
let sptPresets = false;
let missingIconLink = [];
let missingGridImage = [];
let missingBaseImage = [];
const shortNames = {};
const itemsByHash = {};
const itemsById = {};

const iconCacheFolder = process.env.LOCALAPPDATA+'\\Temp\\Battlestate Games\\EscapeFromTarkov\\Icon Cache\\live\\'
let iconData = {};

let ready = false;

const colors = {
    violet: [
        '#271d2a',
        '#2c232f',
    ],
    grey: [
        '#191a1a',
        '#1e1e1e',
    ],
    yellow: [
        '#2f301d',
        '#343421',
    ],
    orange: [
        '#221611',
        '#261d14',
    ],
    green: [
        '#161c11',
        '#1a2314',
    ],
    red: [
        '#311c18',
        '#38221f',
    ],
    default: [
        '#363537',
        '#3a3c3b',
    ],
    black: [
        '#100f11',
        '#141614',
    ],
    blue: [
        '#1d262f',
        '#202d32',
    ],
};

const getItemId = (itemIndex, options) => {
    if (options.forceImageIndex && options.forceImageIndex == itemIndex) {
        options.shutdown = true;
        const itemId = options.targetItemId;
        let colorId = options.targetItemId;
        if (presets[itemId]) {
            colorId = presets[itemId].baseId;
        }
        return {color: colorId, filename: itemId};
    } 
    for(const key in iconData){
        if(iconData[key] != itemIndex){
            continue;
        }
        if (itemsByHash[key]) {
            const item = itemsByHash[key];
            return {color: item.id, filename: item.id};
        }
        return false;
    }

    //console.log(`Found no itemId for ${itemIndex}`);

    return false;
};

const getItemColors = (itemId) => {
    if(!bsgData[itemId]){
        console.log(`${itemId} not found in bsgData`)
        return false;
    }

    if (!bsgData[itemId]._props) {
        console.log(`${itemId} has no _props`);
    }

    if (!colors[bsgData[itemId]._props.BackgroundColor]) {
        return false;
    }
    return colors[bsgData[itemId]._props.BackgroundColor];
};

const getIcon = async (filename, options) => {
    const itemId = getItemId(path.basename(filename, '.png'), options);
    if (!itemId) {
        console.log(`No itemId found for ${filename}`);
        return Promise.reject(new Error('No itemId found'));
    }
    if (options.targetItemId && options.targetItemId != itemId.filename) {
        return Promise.reject(new Error(`itemId (${itemId.filename}) does not match ${options.targetItemId}`));
    }
    const itemColors = getItemColors(itemId.color);

    if(!itemColors){
        console.log(`No colors found for ${itemId.color} (${filename})`);
        return Promise.reject(new Error(`No colors found for ${itemId.color}`));
    }

    let shortName = false;
    if (presets[itemId.filename]) {
        shortName = presets[itemId.filename].name+'';
    } else if (shortNames[itemId.filename]) {
        shortName = shortNames[itemId.filename]+'';
    }

    const sourceImage = await Jimp.read(path.join(iconCacheFolder, filename));

    const baseImagePromise = new Promise(resolve => {
        if(missingBaseImage.includes(itemId.filename)){
            console.log(`${itemId.filename} should be uploaded for base-image`);
            fs.copyFileSync(path.join(iconCacheFolder, filename), path.join('./', 'generated-images-missing', `${itemId.filename}-base-image.png`));
        }
        resolve(true);
    });

    // create icon
    const iconPromise = new Promise(async resolve => {
        if (options.generateOnlyMissing && !missingIconLink.includes(itemId.filename)) {
            resolve(true);
            return;
        }
        const promises = [];
        const checks = new Jimp(62, 62);
        checks.scan(0, 0, checks.bitmap.width, checks.bitmap.height, function(x, y) {
            checks.setPixelColor(Jimp.cssColorToHex(itemColors[(x + y) % 2]), x, y);
        });

        const image = await Jimp.read(path.join(iconCacheFolder, filename));
        image
            .scaleToFit(64, 64)
            .contain(64, 64)
            .crop(1, 1, 62, 62)
            .composite(checks, 0, 0, {
                mode: Jimp.BLEND_DESTINATION_OVER,
            });

        promises.push(image.writeAsync(path.join('./', 'generated-images', `${itemId.filename}-icon.jpg`)));

        if(missingIconLink.includes(itemId.filename)){
            console.log(`${itemId.filename} should be uploaded for icon`);
            promises.push(image.writeAsync(path.join('./', 'generated-images-missing', `${itemId.filename}-icon.jpg`)));
        }
        await Promise.all(promises);
        resolve(true);
    });

    // create grid image
    const gridImagePromise = new Promise(async resolve => {
        if (options.generateOnlyMissing && !missingGridImage.includes(itemId.filename)) {
            resolve(true);
            return;
        }
        const promises = [];
        const checks = new Jimp(sourceImage.bitmap.width, sourceImage.bitmap.height);
        checks.scan(0, 0, checks.bitmap.width, checks.bitmap.height, function(x, y) {
            checks.setPixelColor(Jimp.cssColorToHex(itemColors[(x + y) % 2]), x, y);
        });

        const image = await Jimp.read(path.join(iconCacheFolder, filename));
        image
            .composite(checks, 0, 0, {
                mode: Jimp.BLEND_DESTINATION_OVER,
            });

        if (shortName) {
            try {
                shortName = shortName.trim().replace(/\r/g, '').replace(/\n/g, '');
            } catch (error) {
                console.log(`Error trimming shortName ${shortName} for ${JSON.stringify(itemId)}`);
                shortName = false;
            }
        } else {
            console.log(`No shortName for ${JSON.stringify(itemId)}`);
        }
        if (shortName) {
            let namePrinted = false;
            let fontSize = 12;
            let textWidth = sourceImage.bitmap.width;
            while (!namePrinted && fontSize > 9) {
                await Jimp.loadFont(path.join(__dirname, 'fonts', `Bender-Bold-${fontSize}.fnt`)).then(font => {
                    try {
                        textWidth = Jimp.measureText(font, shortName);
                        if (textWidth < sourceImage.bitmap.width) {
                            image.print(font, sourceImage.bitmap.width-textWidth-2, 2, {
                                text: shortName,
                                alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                                alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                            });
                            namePrinted = true;
                        }
                    } catch (error) {
                        console.log(`Error adding text to ${shortName} ${itemId.filename}`);
                        console.log(error);
                    }
                });
                fontSize--;
            }
            let clippedName = shortName;
            if (!namePrinted) {
                while (!namePrinted && (clippedName.includes('/') || clippedName.includes(' '))) {
                    const lastSpace = clippedName.lastIndexOf(' ');
                    const lastSlash = clippedName.lastIndexOf('/');
                    let cutoff = lastSpace;
                    if (lastSlash > lastSpace) cutoff = lastSlash;
                    if (cutoff == -1) break;
                    clippedName = clippedName.substring(0, cutoff);
                    await Jimp.loadFont(path.join(__dirname, 'fonts', `Bender-Bold-12.fnt`)).then(font => {
                        try {
                            textWidth = Jimp.measureText(font, clippedName);
                            if (textWidth < sourceImage.bitmap.width) {
                                image.print(font, sourceImage.bitmap.width-textWidth-2, 2, {
                                    text: clippedName,
                                    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                                });
                                namePrinted = true;
                            }
                        } catch (error) {
                            console.log(`Error adding text to ${shortName} ${itemId.filename}`);
                            console.log(error);
                        }
                    });
                    if (namePrinted) break;
                    await Jimp.loadFont(path.join(__dirname, 'fonts', `Bender-Bold-11.fnt`)).then(font => {
                        try {
                            textWidth = Jimp.measureText(font, clippedName);
                            if (textWidth < sourceImage.bitmap.width) {
                                image.print(font, sourceImage.bitmap.width-textWidth-2, 2, {
                                    text: clippedName,
                                    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                                });
                                namePrinted = true;
                            }
                        } catch (error) {
                            console.log(`Error adding text to ${shortName} ${itemId.filename}`);
                            console.log(error);
                        }
                    });
                }
            }
            if (!namePrinted) {
                clippedName = shortName;
                const firstSpace = clippedName.indexOf(' ');
                const firstSlash = clippedName.indexOf('/');
                let cutoff = firstSpace;
                if (firstSlash < firstSpace) cutoff = firstSlash;
                if (cutoff == -1) cutoff = clippedName.length;
                while (!namePrinted) {
                    clippedName = clippedName.substring(0, clippedName.length-1);
                    await Jimp.loadFont(path.join(__dirname, 'fonts', `Bender-Bold-12.fnt`)).then(font => {
                        try {
                            textWidth = Jimp.measureText(font, clippedName);
                            if (textWidth < sourceImage.bitmap.width) {
                                image.print(font, sourceImage.bitmap.width-textWidth-2, 2, {
                                    text: clippedName,
                                    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                                });
                                namePrinted = true;
                            }
                        } catch (error) {
                            console.log(`Error adding text to ${shortName} ${itemId.filename}`);
                            console.log(error);
                        }
                    });
                    if (namePrinted) break;
                    await Jimp.loadFont(path.join(__dirname, 'fonts', `Bender-Bold-11.fnt`)).then(font => {
                        try {
                            textWidth = Jimp.measureText(font, clippedName);
                            if (textWidth < sourceImage.bitmap.width) {
                                image.print(font, sourceImage.bitmap.width-textWidth-2, 2, {
                                    text: clippedName,
                                    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
                                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                                });
                                namePrinted = true;
                            }
                        } catch (error) {
                            console.log(`Error adding text to ${shortName} ${itemId.filename}`);
                            console.log(error);
                        }
                    });
                }
            }
            if (!namePrinted) {
                fs.writeFile(path.join('./', 'logging', `${shortName.replace(/[^a-zA-Z0-9]/g, '')}-${itemId.filename}-not-printed.json`), JSON.stringify({shortName: shortName, id: itemId.filename}, null, 4), 'utf8', (err) => {
                    if (err) {
                        console.log(`Error writing no prices found file: ${err}`);
                    }
                });
            }
        }

        promises.push(image.writeAsync(path.join('./', 'generated-images', `${itemId.filename}-grid-image.jpg`)));

        if(missingGridImage.includes(itemId.filename)){
            console.log(`${itemId.filename} should be uploaded for grid-image`);
            promises.push(image.writeAsync(path.join('./', 'generated-images-missing', `${itemId.filename}-grid-image.jpg`)));
        }
        await Promise.all(promises);
        resolve(true);
    });
    if (options.targetItemId == itemId.filename) {
        options.shutdown = true;
    }
    await Promise.all([baseImagePromise, iconPromise, gridImagePromise]);
    return true;
}

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
        hash: 2111427698,
        type: 'weapon'
    },
    'aks74u': {
        id: '57dc2fa62459775949412633',
        hash: 592229284,
        type: 'weapon'
    }
};

const refreshCache = () => {
    iconData = require(iconCacheFolder+'index.json');
};

const initialize = async () => {
    ready = false;
    try {
        bsgData = JSON.parse(fs.readFileSync('./items.json', 'utf8'));
        const stats = fs.statSync('./items.json');
        if (Date.now() - stats.mtimeMs > 1000*60*60*24) {
            throw new Error('stale');
        }
    } catch (error) {
        try {
            bsgData = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/templates/items.json')).body);
            fs.writeFileSync('./items.json', JSON.stringify(bsgData, null, 4));
        } catch (downloadError) {
            if (error.message != 'stale') {
                return Promise.reject(downloadError);
            }
        }
    }
    try {
        presets = JSON.parse(fs.readFileSync('./item_presets.json', 'utf8'));
        const stats = fs.statSync('./item_presets.json');
        if (Date.now() - stats.mtimeMs > 1000*60*60*24) {
            throw new Error('stale');
        }
    } catch (error) {
        try {
            presets = JSON.parse((await got('https://raw.githubusercontent.com/Razzmatazzz/tarkovdata/master/item_presets.json')).body);
            fs.writeFileSync('./item_presets.json', JSON.stringify(presets, null, 4));
        } catch (downloadError) {
            if (error.message != 'stale') {
                return Promise.reject(downloadError);
            }
        }
    }
    try {
        sptPresets = JSON.parse(fs.readFileSync('./spt_presets.json', 'utf8'));
        const stats = fs.statSync('./spt_presets.json');
        if (Date.now() - stats.mtimeMs > 1000*60*60*24) {
            throw new Error('stale');
        }
    } catch (error) {
        try {
            sptPresets = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/globals.json')).body)['ItemPresets'];
            fs.writeFileSync('./spt_presets.json', JSON.stringify(sptPresets, null, 4));
        } catch (downloadError) {
            if (error.message != 'stale') {
                return Promise.reject(downloadError);
            }
        }
    }
    let foundBaseImages = false;
    try {
        foundBaseImages = JSON.parse((await got('https://tarkov-data-manager.herokuapp.com/data/existing-bases.json')).body);
    } catch (error) {
        console.log(`Error downloading found base image list: ${error}`);
    }
    try {
        const response = await got.post('https://tarkov-tools.com/graphql', {
            body: JSON.stringify({query: `{
                itemsByType(type: any){
                  id
                  shortName
                  iconLink
                  gridImageLink
                  types
                }
              }`
            }),
            responseType: 'json',
        });
        hashCalc.init(bsgData, sptPresets, presets);
        missingGridImage = [];
        missingIconLink = [];
        missingBaseImage = [];
        response.body.data.itemsByType.map((itemData) => {
            if (itemData.types.includes('disabled')) return;
            if(!itemData.gridImageLink){
                missingGridImage.push(itemData.id);
            }

            if(!itemData.iconLink){
                missingIconLink.push(itemData.id);
            }
            if (foundBaseImages && !foundBaseImages.includes(itemData.id)) {
                missingBaseImage.push(itemData.id);
            }
            shortNames[itemData.id] = itemData.shortName;
            itemData['backgroundColor'] = 'default';
            if(bsgData[itemData.id]){
                if (bsgData[itemData.id]._props) {
                    if (colors[bsgData[itemData.id]._props.BackgroundColor]) {
                        itemData['backgroundColor'] = bsgData[itemData.id]._props.BackgroundColor;
                    }
                }
            }
            itemsById[itemData.id] = itemData;

            try {
                const hash = hashCalc.getItemHash(itemData.id);
                /*if (itemData.id == '55d4887d4bdc2d962f8b4570') {
                    console.log(hash);
                    process.exit();
                }*/
                itemsByHash[hash.toString()] = itemData;
            } catch (error) {
                console.log(`Error hashing ${itemData.id}: ${error}`);
            }
        });
    } catch (error) {
        return Promise.reject(error);
    }
    try {
        refreshCache();
    } catch (error) {
        console.log('Icon cache is missing; call refreshCache() before generating icons');
    }
    ready = true;
};

const generate = async (options, forceImageIndex) => {
    const defaultOptions = {targetItemId: false, forceImageIndex: false, generateOnlyMissing: false, shutdown: false};
    if (!options) options = defaultOptions;
    if (typeof options === 'string') {
        options = {
            targetItemId: options
        };
    }
    if (forceImageIndex) {
        options.forceImageIndex = forceImageIndex;
        if (!options.targetItemId) {
            return Promise.reject(new Error('You must specify the target item id to use forceImageIndex'));
        }
    }
    options = {
        ...defaultOptions,
        ...options
    };
    if (!ready) {
        return Promise.reject(new Error('Must call initializeImageGenerator before generating images'));
    }
    const files = fs.readdirSync(iconCacheFolder);

    if (files.length == 0) {
        return Promise.reject(`No files found in ${iconCacheFolder}`);
    }

    console.log(`Found ${missingGridImage.length} items missing a grid image and ${missingIconLink.length} missing an icon`);

    try {
        const imgDir = path.join('./', 'generated-images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

        const missingImgDir = path.join('./', 'generated-images-missing');
        if (!fs.existsSync(missingImgDir)) {
            fs.mkdirSync(missingImgDir);
        } else {
            console.log('Removing old missing images...');
            const oldMissingFiles = fs.readdirSync(missingImgDir);
            for (let i = 0; i < oldMissingFiles.length; i++) {
                fs.unlink(path.join(missingImgDir, oldMissingFiles[i]), (err) => {
                    if (err) {
                        throw err;
                    }
                });
            }
        }

    } catch (mkdirError){
        // Do nothing
        console.log(mkdirError);
        return Promise.reject(mkdirError);
    }

    let successCount = 0;
    let shutdownError = false;
    for(let i = 0; i < files.length && !options.shutdown; i = i + 1){
        try {
            console.log(`Processing ${i + 1}/${files.length}`);
            await getIcon(files[i], options);
            successCount++;
            shutdownError = false;
        } catch (error) {
            if (options.shutdown) {
                shutdownError = error;
            }
        }
    }
    if (successCount == 0 && options.targetItemId) {
        return Promise.reject(new Error(`Found no matching icons for ${options.targetItemId}`));
    }

    const uploadCount = await uploadImages();
    if (shutdownError) {
        return Promise.reject(shutdownError);
    }
    return uploadCount;
};

module.exports = {
    initializeImageGenerator: initialize,
    generateImages: generate,
    refreshCache: refreshCache
};
