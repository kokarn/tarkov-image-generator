#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const got = require('got');

const Jimp = require('jimp');

const uploadImages = require('./upload-images');
const hashCalc = require('./hash-calculator');
const sleep = require('./sleep');

let bsgData = false;
let presets = false;
let sptPresets = false;
let missingIconLink = [];
let missingGridImage = [];
const shortNames = {};
const itemsByHash = {};
const itemsById = {};

let shutdown = false;

const iconCacheFolder = process.env.LOCALAPPDATA+'\\Temp\\Battlestate Games\\EscapeFromTarkov\\Icon Cache\\live\\'
const iconData = require(iconCacheFolder+'index.json');

let generateItemId = false;
let imageIndex = false;
let ready = false;
let abort = false;

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

const getItemId = (itemIndex) => {
    if (imageIndex && imageIndex == itemIndex) {
        shutdown = true;
        const itemId = itemId;
        let colorId = ItemId;
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

const getIcon = async (filename) => {
    const itemId = getItemId(path.basename(filename, '.png'));
    if (!itemId) {
        console.log(`No itemId found for ${filename}`);
        return false;
    }
    if (generateItemId && generateItemId != itemId.filename) {
        return false;
    }
    const itemColors = getItemColors(itemId.color);

    if(!itemColors){
        console.log(`No colors found for ${itemId.color} (${filename})`);
        return false;
    }

    let shortName = false;
    if (presets[itemId.filename]) {
        shortName = presets[itemId.filename].name+'';
    } else if (shortNames[itemId.filename]) {
        shortName = shortNames[itemId.filename]+'';
    }

    const sourceImage = await Jimp.read(path.join(iconCacheFolder, filename));
    new Jimp(62, 62, async (err, checks) => {
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

        image.write(path.join('./', 'generated-images', `${itemId.filename}-icon.jpg`));

        if(missingIconLink.includes(itemId.filename)){
            console.log(`${itemId.filename} should be upladed for icon`);
            image.write(path.join('./', 'generated-images-missing', `${itemId.filename}-icon.jpg`));
        }
    });

    new Jimp(sourceImage.bitmap.width, sourceImage.bitmap.height, async (err, checks) => {
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

        image.write(path.join('./', 'generated-images', `${itemId.filename}-grid-image.jpg`));

        if(missingGridImage.includes(itemId.filename)){
            console.log(`${itemId.filename} should be upladed for grid-image`);
            image.write(path.join('./', 'generated-images-missing', `${itemId.filename}-grid-image.jpg`));
        }
    });
    if (generateItemId == itemId.filename) {
        shutdown = true;
    }
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

(async () => {
    try {
        bsgData = JSON.parse(fs.readFileSync('./items.json', 'utf8'));
    } catch (error) {
        try {
            bsgData = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/templates/items.json')).body);
            fs.writeFileSync('./items.json', JSON.stringify(bsgData, null, 4));
        } catch (error) {
            abort = error;
            return;
        }
    }
    try {
        presets = JSON.parse(fs.readFileSync('./item_presets.json', 'utf8'));
    } catch (error) {
        try {
            presets = JSON.parse((await got('https://raw.githubusercontent.com/Razzmatazzz/tarkovdata/master/item_presets.json')).body);
            fs.writeFileSync('./item_presets.json', JSON.stringify(presets, null, 4));
        } catch (error) {
            abort = error;
            return;
        }
    }
    try {
        sptPresets = JSON.parse(fs.readFileSync('./spt_presets.json', 'utf8'));
    } catch (error) {
        try {
            sptPresets = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/globals.json')).body)['ItemPresets'];
            fs.writeFileSync('./spt_presets.json', JSON.stringify(sptPresets, null, 4));
        } catch (error) {
            abort = error;
            return;
        }
    }
    ready = true;
})();

module.exports = async (id, index) => {
    itemId = id;
    imageIndex = index;
    while (!ready && !abort) {
        await sleep(100);
    }
    if (abort) {
        return Promise.reject(abort);
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
        response.body.data.itemsByType.map((itemData) => {
            if(!itemData.gridImageLink){
                missingGridImage.push(itemData.id);
            }

            if(!itemData.iconLink){
                missingIconLink.push(itemData.id);
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
                /*if (itemId && itemId == itemData.id) {
                    console.log(hash);
                    process.exit();
                }*/
                itemsByHash[hash.toString()] = itemData;
            } catch (error) {
                console.log(`Error hashing ${itemData.id}: ${error}`);
            }
        });
    } catch (error) {
        console.log(error);
        return Promise.reject(error);
    }
    const files = fs.readdirSync(iconCacheFolder);

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

    for(let i = 0; i < files.length && !shutdown; i = i + 1){
        console.log(`Processing ${i + 1}/${files.length}`);
        await getIcon(files[i]);

        // break;
    }

    await uploadImages();
};
