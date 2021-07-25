const fs = require('fs');
const path = require('path');

const got = require('got');
const FormData = require('form-data');

const ENDPOINT = 'https://tarkov-data-manager.herokuapp.com/suggest-image';

module.exports = async () => {
    const uploadFiles = fs.readdirSync(path.join('./', 'images-missing'));

    for(const filename of uploadFiles){
        const form = new FormData();
        const matches = filename.match(/(?<id>.{24})-(?<type>.+?)\.jpg/);

        if(!matches){
            console.log(`Found junkfile ${filename}, skipping`);

            continue;
        }

        form.append('id', matches.groups.id);
        form.append('type', matches.groups.type);
        form.append(matches.groups.type, fs.createReadStream(path.join('./', 'images-missing', filename)));

        try {
            console.log(`Uploading new ${matches.groups.type} for ${matches.groups.id}`);

            await got.post(ENDPOINT, {
                body: form,
            });
        } catch (someError){
            if(!someError.response){
                console.log(someError);
            } else {
                console.log(someError.response.statusCode);
                console.log(someError.response.body);
            }
        }
    }
};

