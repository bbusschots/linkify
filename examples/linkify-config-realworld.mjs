// Example Linkifier Customisation Module - Real-World
// ================================================
// This customisation module defines both link generation customisations and
// default CLI options. It is a snapshot of the actual customisations Bart
// Busschots uses when writting show notes for the Let's Talk Apple podcast and
// the Security Bits segment on the NosillaCast Podcast taken in April 2026.

// Import the Needed Linkify Classes
// ---------------------------------
// 1. Linkifier - required for all link generation configuation customisations
// 2. LinkData - required to add custom data transformers
// 3. LinkTemplate - required to add custom templates
import { Linkifier, LinkData, LinkTemplate } from '@bartificer/linkify';

//
// === Customise Link Generation ===
// 

// start with a default linkfier instance
const linkifier = new Linkifier();

// register a custom Markdown link template and make it the default
linkifier.registerTemplate('md-bartificer', new LinkTemplate(
    '[{{{text}}} — {{{uri.hostname}}}{{#uri.hasPath}}/…{{/uri.hasPath}}]({{{url}}})',
    [
        ['url', linkifier.util.stripUTMParameters],
        ['text', linkifier.util.regulariseWhitespace]
    ]
));
linkifier.defaultTemplateName = 'md-bartificer';

// register a special Markdown template for Apple presss releases and make it the default for Apple's domain
linkifier.registerTemplate('md-apr', new LinkTemplate(
    '[{{{text}}} — 📣 Apple PR]({{{url}}})',
    [
        ['url', linkifier.util.stripUTMParameters],
        ['text', linkifier.util.regulariseWhitespace]
    ]
));
linkifier.registerDefaultTemplateMapping('apple.com', 'md-apr');

// register a special Markdown template for XKCD cartoons and make it the default for XKCD's domain
linkifier.registerTemplate('md-xkcd', new LinkTemplate(
    '[XKCD {{{extraFields.comicNumber}}}: {{{extraFields.title}}}]({{{extraFields.permalink}}})\n![ADD A DESCRIPTION FOR THE VISUALLY IMPAIRED HERE]({{{extraFields.imageLink}}} "{{{extraFields.hoverText}}}")',
    null, // no field filters
    ($) => { // a custom field extractor function
        const $img = $('div#comic img').first(); // the cheerio selector to find the comic image
        const $comicLinks = $('div#middleContainer > a'); // the cheerio selector to find the two permalinks
        const permalink = $comicLinks.first().attr('href'); // the first permalink of the two is the one for the page
        const imageLink = $comicLinks.last().attr('href'); // second permalink of the two is the one for the image
        const comicNumber = permalink.match(/(?<comicNum>\d+)\/?$/).groups.comicNum;
        return {
            title: $('div#ctitle').text(), // capture the comic's title
            hoverText: $img.attr('title').replaceAll('"', '\\"'), // capture the all important hover text!
            imageLink,
            permalink,
            comicNumber
        };
    }
));
linkifier.registerDefaultTemplateMapping('xkcd.com', 'md-xkcd');

// register a special Markdown template that just contains the link title, and nothing more
linkifier.registerTemplate('md-title-only', new LinkTemplate(
    '[{{{text}}}]({{{url}}})',
    [
        ['url', linkifier.util.stripUTMParameters],
        ['text', linkifier.util.regulariseWhitespace]
    ]
));

// capture any templates that should be made available for special cases
const templates = {
    mastodonServer: 'md-title-only'
}

// Cache commonly needed transforer functions to reduce code repetition
// NOTE: these are the transformers that are available as special cases
const transformers = {
    mainHeading: function(pData){
        return new LinkData(pData.url, pData.mainHeading);
    },
    titleMinusPrefix: function(pData, prefix){
        const regex = new RegExp(`^${linkifier.util.escapeRegex(prefix)}`);
        return new LinkData(pData.url, pData.title.replace(regex, '').trim());
    },
    titleMinusPostscript: function(pData, postscript){
        const regex = new RegExp(`${linkifier.util.escapeRegex(postscript)}$`);
        return new LinkData(pData.url, pData.title.replace(regex, '').trim());
    },
    mastodonServer: function(pData){
        const mastodonServer = pData.uri.hostname();

        // see if the link points to a user-related page on the server
        const mastodonPathMatch = pData.uri.path().match(/^\/@(?<handle>[^\/]+)(?:\/(?<postId>\d+))?/);
        if (mastodonPathMatch && mastodonPathMatch.groups){
            // if so, return the handle as the link text and the post ID as the description (if there is one)
            const handle = mastodonPathMatch.groups.handle;
            const postId = mastodonPathMatch.groups.postId;

            // see if we're a post or some kind of profile page
            if(postId){
                // this is a post, so use the handle and the post snippet as the text

                // extract the post snippet from the title
                let snippet = pData.title.replace(/^[^"]+"/, '').replace(/"[^"]+$/, '').trim();

                return new LinkData(pData.url, `@${handle}@${mastodonServer} on Mastodon: "${snippet}"`);
            }else{
                // some kind of profile page, so just return the handle with some text to indicate this is a Mastodon server
                return new LinkData(pData.url, `@${handle}@${mastodonServer} on Mastodon`);
            }
            return new LinkData(pData.url, pData.title, mastodonServer);
        } else {
            // we're on a generic page, so return the title with with a note that this is a Mastodon server
            return new LinkData(pData.url, `${pData.title} (Mastodon)`);
        }
    }
};

// define & register custom transformers for domains that need them
linkifier.registerTransformer('9to5mac.com', transformers.mainHeading);
linkifier.registerTransformer('apod.nasa.gov', (pData) => {
    // parse the title to extract the date and picture title
    let titlePartsMatch = pData.title.match(/^APOD:[ ](?<year>\d{4})[ ](?<month>[a-zA-Z]+)[ ](?<day>\d{1,2})[ ]–[ ](?<title>.+)$/);
    if(titlePartsMatch && titlePartsMatch.groups){
        return new LinkData(
            pData.url,
            `NASA Astronomy Picture of the Day for ${titlePartsMatch.groups.day} ${titlePartsMatch.groups.month} ${titlePartsMatch.groups.year}: ${titlePartsMatch.groups.title}`,
        )
    } else {
        // fall back on just using the title
        return new LinkData(pData.url, pData.title);
    }
});
linkifier.registerTransformer('social.bartificer.ie', transformers.mastodonServer);
linkifier.registerTransformer('cultofmac.com', transformers.mainHeading);
linkifier.registerTransformer('daringfireball.net', (pData) => transformers.titleMinusPrefix(pData, 'Daring Fireball: '));
linkifier.registerTransformer('intego.com', (pData) => transformers.titleMinusPostscript(pData, ' | Intego'));
linkifier.registerTransformer('isc.sans.edu', (pData) => { return new LinkData(pData.url, pData.h1s[1]); });
linkifier.registerTransformer('krebsonsecurity.com', (pData) => transformers.titleMinusPostscript(pData, ' – Krebs on Security'));
linkifier.registerTransformer('macstories.net', (pData) => transformers.titleMinusPostscript(pData, ' - MacStories'));
linkifier.registerTransformer('nakedsecurity.sophos.com', (pData) => transformers.titleMinusPostscript(pData, ' – Naked Security'));
linkifier.registerTransformer('overcast.fm', function(pData){
    // strip Overcast append, split on em-dash to replace with n-dash and get podcast name
    let textParts =  pData.title.replace(' — Overcast', '').split('—');
    let podcastName = textParts.pop();

    // re-assemble the text
    let linkText = podcastName.trim() + ': ' + textParts.join(' – ').replace(/[ ]+/g, ' ').replace(':', '-').trim();
    return new LinkData(pData.url, linkText);
});
linkifier.registerTransformer('sixcolors.com', transformers.mainHeading);
linkifier.registerTransformer('theverge.com', transformers.mainHeading);
linkifier.registerTransformer('wired.com', transformers.mainHeading);

//
// ==== Customise the CLI ===
//

// force reading and writting to and from the clipboard with echoing to STDOUT
const options = {
    clipboard: true,
    echoClipboard: true,
};

//
// === Export all Customisations ===
//
const config = { linkifier, options };
export {config as default};