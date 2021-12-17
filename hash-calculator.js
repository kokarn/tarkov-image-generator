let items = false;
let presets = false;
let ttPresets = false;
const weaponTypes = [
    '5447b5cf4bdc2d65278b4567', // pistol
    '617f1ef5e8b54b0998387733', // revolver
    '5447b5e04bdc2d62278b4567', // smg
    '5447b5f14bdc2d61278b4567', // assault rifle
    '5447b5fc4bdc2d87278b4567', // assault carbine
    '5447b6094bdc2dc3278b4567', // shotgun
    '5447b6194bdc2d67278b4567', // marksman rifle
    '5447b6254bdc2dc3278b4568', // sniper rifle
    '5447bed64bdc2d97278b4568', // machine gun
    '5447bedf4bdc2d87278b4568', // grenade launcher
    '5447bee84bdc2dc3278b4569', // special weapon (??)
];

// <3 to Moritz
// https://github.com/RatScanner/RatStash/blob/master/RatStash/CacheHashIndexParser.cs
const getStringHash = (str) => {
    var hash1 = 5381 | 0;
    var hash2 = hash1 | 0;
  
    for (var i = 0; i < str.length - 1; i += 2) {
        var c = str.charCodeAt(i)
        hash1 = ToInt32((hash1 << 5) + hash1) ^ c;
        c = str.charCodeAt(i + 1);
        if (isNaN(c)) {
            break;
        }
      hash2 = ToInt32((hash2 << 5) + hash2) ^ c;
    }
  
    return ToInt32(hash1 + (Math.imul(hash2, 1566083941)));
};

const ToInt32 = (x) => {
    var uint32 = x % Math.pow(2, 32);
    if (uint32 >= Math.pow(2, 31)) {
        return uint32 - Math.pow(2, 32)
    } else {
        return uint32;
    }
};

const getItemHash = (itemId) => {
    if (!items || !presets || !ttPresets) throw new Error('Must initialize with items and presets!');
    const item = items[itemId];
    let hash = 17;
    hash ^= getSingleItemHash(itemId);

    if (item && weaponTypes.includes(item._parent)) {
        hash = getContainerHash(hash, item);
    }
    if (item && item._parent == '5485a8684bdc2da71d8b4567') {
        //ammo
        hash ^= (27 * 56);
    } 
    return hash;
};

const getContainerHash = (hash, item) => {
    let preset = false;
    for (const presetId in ttPresets) {
        //console.log(ttPresets[i]);
        if (ttPresets[presetId].baseId == item._id && ttPresets[presetId].default) {
            //console.log(`matched ${ttPresets[presetId].name}`);
            preset = presets[ttPresets[presetId].id];
            break;
        }
    }
    if (!preset) throw new Error(`Default preset not found for ${item._id}`);
    let cartridges = [];
    let magazine = false;
    for (let i = 0; i < preset._items.length; i++) {
        const part = preset._items[i];
        if (part.slotId) {
            if (part.slotId == 'cartridges') {
                cartridges.push(part);
            } else if (part.slotId == 'mod_magazine') {
                magazine = part;
            } else {
                hash ^= getStringHash(part.slotId);
                hash ^= getSingleItemHash(part._tpl);
            }
        }
    }
    if (magazine) {
        magazine.cartridges = cartridges;
        hash ^= getStringHash(magazine.slotId);
        hash ^= getSingleItemHash(magazine._tpl, magazine);
    }
    return hash;
}

const getSingleItemHash = (itemId, magazineInfo) => {
    let hash = 0;
    if (!itemId) return hash;
    hash ^= getStringHash(itemId);

    if (items[itemId] && items[itemId]._parent == '5a2c3a9486f774688b05e574') {
        // hash for nvgs
        hash ^= 23;
    } else if (items[itemId] && items[itemId]._parent == '57bef4c42459772e8d35a53b') {
        // ArmoredEquipment
        hash ^= 23;
    } else if (items[itemId] && items[itemId]._parent == '5448bc234bdc2d3c308b4569') {
        // magazine
        //hash ^= getStringHash('cartridges');
        if (!magazineInfo) {
            hash ^= 24 << 2;
        } else {
            let cartridgeCount = 0;
            for (let i = 0; i < magazineInfo.cartridges.length; i++) {
                const cart = magazineInfo.cartridges[i];
                if (cart.upd && cart.upd.StackObjectsCount) {
                    cartridgeCount += cart.upd.StackObjectsCount;
                } else {
                    cartridgeCount++;
                }
            }
            hash ^= 23 + getMaxVisibleAmmo(itemId, cartridgeCount) << 2;
        }
    } 

    return hash;
};

// https://github.com/RatScanner/RatStash/blob/master/RatStash/Item/CompoundItem/WeaponMod/GearMod/Magazine.cs
const getVisibleAmmoRanges = (itemId) => {
    const visibleAmmoRangesString = items[itemId]._props.VisibleAmmoRangesString;
    if (!visibleAmmoRangesString) {
        return [{start: 1, end: 2}];
    }
    const ranges = [];
    const splits = visibleAmmoRangesString.split(';');
    for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const range = split.split('-');
        ranges.push({start: Number(range[0]), end: Number(range[1])});
    }
    return ranges;
};

const getMaxVisibleAmmo = (itemId, cartridgeCount) => {
    const visibleAmmoRanges = getVisibleAmmoRanges(itemId);

    let i = 0;
    while (i < visibleAmmoRanges.length) {
        const { start, end } = visibleAmmoRanges[i];
        if (start <= cartridgeCount && end >= cartridgeCount) return cartridgeCount;
        if (cartridgeCount >= start) i++;
        else return i != 0 ? visibleAmmoRanges[i - 1].end : start;
    }

    return visibleAmmoRanges[visibleAmmoRanges.length - 1][1]
}
module.exports = {
    getItemHash: getItemHash,
    init: (bsgItems, bsgPresets, ttpresets) => {
        items = bsgItems;
        presets = bsgPresets;
        ttPresets = ttpresets;
    }
};
