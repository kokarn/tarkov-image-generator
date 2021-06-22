#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const got = require('got');

const Jimp = require('jimp');

let bsgData = false;
let lang = false;
let presets = false;

let defaultPresets = {};

const iconCacheFolder = process.env.LOCALAPPDATA+'\\Temp\\Battlestate Games\\EscapeFromTarkov\\Icon Cache\\'
const iconData = require(iconCacheFolder+'index.json');

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

const presetHasPart = (preset, itemId) => {
    for (let i = 0; i < preset.parts.length; i++) {
        if (preset.parts[i].id == itemId) {
            return true;
        }
    }
    return false;
}

const getItemId = (itemIndex) => {
    for(const key in iconData){
        if(iconData[key] != itemIndex){
            continue;
        }
        if (key.trim().length == 24) {
            return {color: key.trim(), filename: key.trim()};
        }
        const baseItemId = key.substring(0,24);
        if (process.argv[2] && process.argv[2] != baseItemId) {
            continue;
        }
        const components = key.substring(25, key.length).split(' , ');
        const parts = [baseItemId];
        let foldedStock = false;
        for (let i = 0; i < components.length; i++) {
            const comp = components[i].split(': ');
            const slotName = comp[0];
            if (comp.length > 1) {
                if (!slotName) continue;
                const partSections = comp[1].split(':');
                let partId = partSections[0];
                if (slotName == 'mod_magazine') {
                    // partSections[1] is either 1 or 3; unknown what it means
                    // 1 might be empty; 3 might have at least some rounds
                } else if (slotName == 'mod_stock') {
                    // partSections[1] is either True or False; meaning unknown
                } else if (slotName == 'cartridges' && partId.includes(' ')) {
                    const rounds = partId.split(' ');
                    parts.push(...rounds);
                    continue;
                }
                parts.push(partId);
            }
            foldedStock = comp[0] == ':True';
        }
        if (parts.length == 1) {
            return {color: parts[0], filename: parts[0], preset: false};
        }
        for (const presetId in presets) {
            const matchedParts = [];
            const preset = presets[presetId];
            if (preset.baseId == baseItemId && parts.length == preset.parts.length && !foldedStock) {
                // the base weapon is the same and the total parts are the same
                // we also don't want images of folded stocks
                for (let i=0; i < parts.length; i++) {
                    if (presetHasPart(preset, parts[i])) {
                        matchedParts.push(parts[i]);
                    }
                }
                if (matchedParts.length == preset.parts.length) {
                    console.log(`Found matching preset: ${preset.name}`);
                    if (lang.templates[preset.baseId].ShortName == preset.name) {
                        return {color: preset.baseId, filename: preset.baseId, preset: true};
                    }
                    return {color: preset.baseId, filename: presetId, preset: true};
                }
            }
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
    if (process.argv[2] && process.argv[2] != itemId.filename) {
        return false;
    }
    if (itemId.preset && itemId.color == itemId.filename) {
        //this is the default preset for an item;
        defaultPresets[itemId.color] = true;
    }
    if (!itemId.preset && itemId.color == itemId.filename && defaultPresets[itemId.color]) {
        // if we already have the preset for a base item, don't make the icon for the base item
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
    } else if (lang.templates[itemId.filename]) {
        shortName = lang.templates[itemId.filename].ShortName+'';
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

        image.write(path.join('./', 'images', `${itemId.filename}-icon.jpg`));
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

        image.write(path.join('./', 'images', `${itemId.filename}-grid-image.jpg`));
    });
}

(async () => {
    try {
        bsgData = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/templates/items.json')).body);
        lang = JSON.parse((await got('https://dev.sp-tarkov.com/SPT-AKI/Server/raw/branch/development/project/assets/database/locales/global/en.json')).body);
        //presets = JSON.parse((await got('https://raw.githack.com/TarkovTracker/tarkovdata/master/item_presets.json')).body);
        presets = JSON.parse((await got('https://raw.githack.com/Razzmatazzz/tarkovdata/master/item_presets.json')).body);
    } catch (error) {
        console.log(error);
        return;
    }
    const files = fs.readdirSync(iconCacheFolder);

    try {
        let imgDir = path.join('./', 'images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

        const logDir = path.join('./', 'logging');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    } catch (mkdirError){
        // Do nothing
        console.log(mkdirError);
        return;
    }

    for(let i = 0; i < files.length; i = i + 1){
        console.log(`Processing ${i + 1}/${files.length}`);
        await getIcon(files[i]);

        // break;
    }
})();