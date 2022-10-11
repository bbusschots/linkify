const clipboardy = require('clipboardy');
const linkify = require('../lib.js');

let testURL = clipboardy.readSync();
linkify.fetchPageData(testURL).then(function(d){
    console.log(d);
});