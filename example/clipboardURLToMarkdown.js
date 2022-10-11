// import Linkify Lib
const linkify = require('../lib.js');

// import 3rd-party library for interacting with the clipboard
const clipboardy = require('clipboardy');

// define a custom link template and register it
const mdTitleTpl = new linkify.LinkTemplate('[{{{text}}} — {{{uri.hostname}}}{{#uri.hasPath}}/…{{/uri.hasPath}}]({{{url}}})');
linkify.registerTemplate('md-title', mdTitleTpl);

// define & register custom transformers for domains that need them
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

// read the URL from the clipboard
let testURL = clipboardy.readSync();

// try generate the formatted link from the URL
linkify.generateLink(testURL, 'md-title').then(function(d){
    console.log(d);
});