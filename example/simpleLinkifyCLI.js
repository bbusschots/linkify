//const request = require('request-promise-native');
//const cheerio = require('cheerio');
//
//request({
//    uri: 'https://arstechnica.com/information-technology/2017/10/severe-flaw-in-wpa2-protocol-leaves-wi-fi-traffic-open-to-eavesdropping/',
//    method: 'GET',
//    resolveWithFullResponse: true
//}).then(function(response) {
//    console.log(Object.keys(response));
//    
//    let $ = cheerio.load(response.body);
//    console.log($('title').text());
//});

const clipboardy = require('clipboardy');
const linkify = require('./lib.js');

const mdTitleTpl = new linkify.LinkTemplate('[{{{text}}} — {{{uri.hostname}}}{{#uri.hasPath}}/…{{/uri.hasPath}}]({{{url}}})');
linkify.registerTemplate('md-title', mdTitleTpl);

linkify.registerTransformer('intego.com', function(pData){
    return new linkify.LinkData(pData.url(), pData.title().replace(' | The Mac Security Blog', ''));
});
linkify.registerTransformer('nakedsecurity.sophos.com', function(pData){
    //console.log(pData);
    return new linkify.LinkData(pData.url(), pData.title().replace(' – Naked Security', ''));
});
linkify.registerTransformer('krebsonsecurity.com', function(pData){
    return new linkify.LinkData(pData.url(), pData.title().replace(' – Krebs on Security', ''));
});
linkify.registerTransformer('9to5mac.com', function(pData){
    return new linkify.LinkData(pData.url(), pData.mainHeading());
});
linkify.registerTransformer('bloomberg.com', function(pData){
    return new linkify.LinkData(pData.url(), pData.title().replace(' - Bloomberg', ''));
});
linkify.registerTransformer('wired.com', function(pData){
    //console.log(pData);
    return new linkify.LinkData(pData.url(), pData.mainHeading());
});
linkify.registerTransformer('theverge.com', function(pData){
    //console.log(pData)
    return new linkify.LinkData(pData.url(), pData.title().replace(/[ ][-][ ]The[ ]Verge.*$/, ''));
});
linkify.registerTransformer('daringfireball.net', function(pData){
    //console.log(pData)
    return new linkify.LinkData(pData.url(), pData.title().replace(/^Daring Fireball:[ ]/, ''));
});

//let testURL = 'https://www.arstechnica.com/information-technology/2017/10/severe-flaw-in-wpa2-protocol-leaves-wi-fi-traffic-open-to-eavesdropping/';
//let testURL = 'https://www.arstechnica.com';
let testURL = clipboardy.readSync();
linkify.generateLink(testURL, 'md-title').then(function(d){
    console.log(d);
});