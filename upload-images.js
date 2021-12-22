const fs = require('fs');
const path = require('path');

const got = require('got');
const FormData = require('form-data');

const ENDPOINT = 'https://tarkov-data-manager.herokuapp.com/suggest-image';

module.exports = async () => {
    const uploadFiles = fs.readdirSync(path.join('./', 'generated-images-missing'));

    let uploadCount = 0;
    let currentUploads = [];
    if (uploadFiles.length == 0) return 0;
    for(const filename of uploadFiles){
        const form = new FormData();
        const matches = filename.match(/(?<id>.{24})-(?<type>.+?)\.(?:jpg|png)/);

        if(!matches){
            console.log(`Found junkfile ${filename}, skipping`);

            continue;
        }

        form.append('id', matches.groups.id);
        form.append('type', matches.groups.type);
        form.append(matches.groups.type, fs.createReadStream(path.join('./', 'generated-images-missing', filename)));

        try {
            console.log(`Uploading new ${matches.groups.type} for ${matches.groups.id}`);

            const upload = got.post(ENDPOINT, {
                body: form,
            });
            currentUploads.push(upload);
            if (currentUploads.length >= 1) {
                await Promise.all(currentUploads);
                uploadCount += currentUploads.length;
                currentUploads = [];
            }
        } catch (someError){
            if(!someError.response){
                console.log(someError);
            } else {
                console.log(someError.response.statusCode);
                console.log(someError.response.body);
            }
        }
    }
    return uploadCount;
};

