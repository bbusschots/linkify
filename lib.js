const request = require('request-promise-native');
const cheerio = require('cheerio');
const URI = require('urijs');
const Mustache = require('mustache');

/**
 * A NodeJS module for transforming URLs into pretty links.
 *
 * @module @bartificer/linkify
 */
module.exports = {};

/**
 * A mapping of domain names to data transformation functions.
 *
 * @private
 */
const perDomainPageDataToLinkDataTransmformers = {
    '.' : function(pData){
        let text = pData.title();
        if(pData.h1s().length === 1){
            text = pData.mainHeading();
        }
        return new module.exports.LinkData(pData.url(), text);
    }
}

// TO DO - create a class to represent templates.

/**
 * The registered link templates.
 *
 * @private
 */
const linkTemplates = {
    html: '<a href="{{url}}" title="{{description}}">{{text}}</a>',
    htmlNewTab: '<a href="{{url}}" title="{{description}}" target="_blank" rel="noopener">{{text}}</a>',
    markdown: '[{{{text}}}]({{{url}}})'
}

/**
 * A class to represent data about a web page.
 */
module.exports.PageData = class{
    /**
     * @param {string} url - the URL this object will aggregate data about.
     */
    constructor(url){
        // initialise the properties
        
        /**
         * The URI.js object that will represent the URL.
         *
         * @private
         */
        this._uri = URI();
        
        /**
         * The page title.
         * 
         * @private
         * @type {string}
         */
        this._title = '';
        
        /**
         * The section headings on the page.
         * 
         * @private
         * @type {{h1: string[], h2: string[]}}
         */
        this._headings = {
            h1: [],
            h2: []
        };
        
        // store the URL
        this.url(url);
    }
    
    /**
     * A read and write accessor for getting and setting the URL this object
     * is associated with.
     *
     * @param {string} [url]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns a URL string, when in *set* mode (passed a URL string as the
     * first argument), returns a reference to self to facilitate function
     * chaining. 
     */
    url(){
        // TO DO - validate args
        
        // deal with set mode
        if(arguments.length){
            this._uri = URI(arguments[0]).normalize();
            return this;
        }
        
        // deal with get mode
        return this._uri.toString();
    }
    
    /**
     * A read-only accessor to get the URL as a URI.js object.
     *
     * @returns {object}
     */
    uri(){
        return this._uri.clone();
    }
    
    /**
     * A read-only accessor to get the domain-part of the URL.
     * 
     * @returns {string}
     */
    domain(){
        return this._uri.hostname();
    }
    
    /**
     * A read-only accessor to get the path-part of the URL.
     *
     * @returns {string}
     */
    path(){
        return this._uri.path();
    }
    
    /**
     * A read and write accessor for the page title.
     * 
     * @param {string} [title]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns the title, when in *set* mode (passed a string as the first 
     * argument), returns a reference to self to facilitate function chaining.
     */
    title(){
        // TO DO - validate args
        
        // deal with set mode
        if(arguments.length){
            this._title = String(arguments[0]);
            return this;
        }
        
        // deal with get mode
        return this._title;
    }
    
    /**
     * A read-only accessor for the section headings on the page.
     * 
     * @returns {{h1: string[], h2: string[]}}.
     */
    headings(){
        let ans = {
            h1: [],
            h2: []
        };
        for(let h of this._headings.h1){
            ans.h1.push(h);
        }
        for(let h of this._headings.h2){
            ans.h2.push(h);
        }
        return ans;
    }
    
    /**
     * A read-only accessor for the top-level headings on the page (`h1` tags).
     *
     * @returns {string[]}
     */
    topLevelHeadings(){
        var ans = [];
        for(let h of this._headings.h1){
            ans.push(h);
        }
        return ans;
    }
    
    /**
     * A read-only accessor for the secondary headings on the page (`h2` tags).
     *
     * @returns {string[]}
     */
    secondaryHeadings(){
        var ans = [];
        for(let h of this._headings.h2){
            ans.push(h);
        }
        return ans;
    }
    
    /**
     * A read-only accessor for the first heading on the page.
     * 
     * @returns {string} The text of the first `h1` tag on the page, or if
     * there are no `h1` tags, the text of the first `h2` tag, or, if there are
     * no `h2` tags eiher, an empty string.
     */
    mainHeading(){
        if(this._headings.h1.length > 0){
            return this._headings.h1[0];
        }
        if(this._headings.h2.length > 0){
            return this._headings.h2[0];
        }
        return '';
    }
    
    /**
     * Add a top-level heading.
     *
     * @param {string} h1Text
     * @returns A reference to self to facilitate function chaning.
     */
    addTopLevelHeading(h1Text){
        // TO DO - add argument validation
        this._headings.h1.push(h1Text);
        return this;
    }
    
    /**
     * Add a seconary heading.
     *
     * @param {string} h2Text
     * @returns A reference to self to facilitate function chaning.
     */
    addSecondaryHeading(h2Text){
        // TO DO - add argument validation
        this._headings.h2.push(h2Text);
        return this;
    }
};

/**
 * A shortcut for `.topLevelHeadings()`.
 *
 * @function
 * @see module:@bartificer/linkify.PageData#topLevelHeadings
 * 
 */
module.exports.PageData.prototype.h1s = module.exports.PageData.prototype.topLevelHeadings;

/**
 * A shortcut for `.secondaryHeadings()`.
 *
 * @function
 * @see module:@bartificer/linkify.PageData#secondaryHeadings
 * 
 */
module.exports.PageData.prototype.h2s = module.exports.PageData.prototype.secondaryHeadings;

/**
 * A shortcut for `.addTopLevelHeading()`.
 *
 * @function
 * @see module:@bartificer/linkify.PageData#addTopLevelHeading
 * 
 */
module.exports.PageData.prototype.h1 = module.exports.PageData.prototype.addTopLevelHeading;

/**
 * A shortcut for `.addSecondaryHeading()`.
 *
 * @function
 * @see module:@bartificer/linkify.PageData#addSecondaryHeading
 * 
 */
module.exports.PageData.prototype.h2 = module.exports.PageData.prototype.addSecondaryHeading;

/**
 * A class to represent data available for use when generating an output link
 * with a template.
 */
module.exports.LinkData = class{
    /**
     * @param {string} url - the URL the link will go to.
     * @param {string} [text] - the link text, defaults to URL.
     * @param {string} [description] - a description for the link, defaults to
     * the link text.
     */
    constructor(url, text, description){
        // initialise the properties
        
        /**
         * The URL the link will go to.
         *
         * @private
         */
        this._url = '';
        
        /**
         * The link text.
         * 
         * @private
         * @type {string}
         */
        this._text = '';
        
        /**
         * The link description.
         * 
         * @private
         * @type {string}
         */
        this._description = '';
        
        // store the URL
        this.url(url);
        
        // set the text
        this.text(text || this.url());
        
        // set the description
        this.description(description || this.text());
    }
    
    /**
     * A read and write accessor for getting and setting the URL.
     *
     * @param {string} [url]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns a URL string, when in *set* mode (passed a URL string as the
     * first argument), returns a reference to self to facilitate function
     * chaining. 
     */
    url(){
        // deal with set mode
        if(arguments.length){
            this._url = String(arguments[0]);
            return this;
        }
        
        // deal with get mode
        return this._url;
    }
    
    /**
     * A read and write accessor for the link text.
     * 
     * @param {string} [text]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns the link text, when in *set* mode (passed a string as the first
     * argument), returns a reference to self to facilitate function chaining.
     */
    text(){
        // deal with set mode
        if(arguments.length){
            this._text = String(arguments[0]);
            return this;
        }
        
        // deal with get mode
        return this._text;
    }
    
    /**
     * A read and write accessor for the link description.
     * 
     * @param {string} [description]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns the link description, when in *set* mode (passed a string as the
     * first argument), returns a reference to self to facilitate function
     * chaining.
     */
    description(){
        // deal with set mode
        if(arguments.length){
            this._description = String(arguments[0]);
            return this;
        }
        
        // deal with get mode
        return this._description;
    }
    
    /**
     * Get the link data as a plain object.
     * 
     * returns {object}
     */
    asPlainObject(){
        return {
            url: this.url(),
            text: this.text(),
            description: this.description()
        };
    }
}

/**
 * Fetch the page data for a given URL.
 *
 * @async
 * @param {string} url
 * @returns {module:@bartificer/linkify.PageData}
 */
module.exports.fetchPageData = async function(url){
    // TO DO - add validation
    
    let ans = new this.PageData(url);
    
    // then try load the contents form the web
    let webDownloadResponse = await request({
        uri: url,
        method: 'GET',
        resolveWithFullResponse: true
    });
    let $ = cheerio.load(webDownloadResponse.body);
    ans.title($('title').text());
    $('h1').each(function(){
        ans.h1($(this).text());
    });
    $('h2').each(function(){
        ans.h2($(this).text());
    });
    
    // return the answer
    return ans;
};

/**
 * Generate a link given a URL.
 *
 * @async
 * @param {string} url
 * @returns {string}
 */
module.exports.generateLink = async function(url){
    // TO DO - add validation
    
    // get the page data
    let pData = await this.fetchPageData(url);
    
    // transform the page data to link data
    let lData = perDomainPageDataToLinkDataTransmformers['.'](pData);
    
    // render the link
    return Mustache.render(linkTemplates.markdown, lData.asPlainObject());
}