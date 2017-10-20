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
const linkTemplates = {};

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
         * The URI.js object representing the URL the link will go to.
         *
         * @private
         */
        this._uri = URI();
        
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
            this._uri = URI(String(arguments[0])).normalize();
            return this;
        }
        
        // deal with get mode
        return this._uri.toString();
    }
    
    /**
     * The URL as a URI.js object.
     * 
     * @returns {Object}
     */
    uri(){
        return this._uri.clone();
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
        let ans = {
            url: this.url(),
            text: this.text(),
            description: this.description(),
            uri: URI.parse(this._uri.toString())
        };
        ans.uri.hasPath = ans.uri.path !== '/';
        //console.log(ans);
        return ans;
    }
}

/**
 * A class to represent a link template.
 */
module.exports.LinkTemplate = class{
    /**
     * @param {string} templateString - a Moustache template string.
     * @param {Array} [filters=[]] - an optional array of filter functions.
     * Each element in the array should itself be an array where the first
     * element is a string specifying which fields the filter should be applied
     * to (one of `'all'`, `'url'`, `'text'`, or `'description'`), and the 
     * second the filter function itself which should be a function that takes
     * a single string as an argument and returns a filtered version of that
     * string
     */
    constructor(templateString, filters){
        // TO DO - add validation
        
        /**
         * The Moustache template string.
         *
         * @private
         * @type {string}
         */
        this._templateString = '';
        this.templateString(templateString);
        
        /**
         * The filter functions to be applied to the various fields.
         *
         * @private
         * @type {object}
         */
        this._filters = {
            all: [],
            url: [],
            text: [],
            description: []
        };
        if(Array.isArray(filters)){
            for(let f of filters){
                if(Array.isArray(f)){
                    this.addFilter(...f);
                }
            }
        }
    }
    
    /**
     * A read and write accessor for the template string.
     *
     * @param {string} [templateString]
     * @returns {(string|object)} When in *get* mode (passed no arguments), 
     * returns the template string, when in *set* mode (passed a string as the
     * first argument), returns a reference to self to facilitate function
     * chaining.
     */
    templateString(){
        // deal with set mode
        if(arguments.length){
            this._templateString = String(arguments[0]);
            return this;
        }
        
        // deal with get mode
        return this._templateString;
    }
    
    /**
     * Add a filter to be applied to one or all fields.
     *
     * If an invalid args are passed, the function does not save the filter or
     * throw an error, but it does log a warning.
     *
     * @param {string} fieldName - the special valie `'all'` or a field name.
     * @param {function} filterFn - the filter function.
     * @returns {object} Returns a reference to self to facilitate function
     * chaining.
     */
    addFilter(fieldName, filterFn){
        // make sure that args are at least plausibly valid
        if(typeof fieldName !== 'string' || typeof filterFn !== 'function'){
            console.warn('silently ignoring request to add filter due to invalid args');
            return this;
        }
        
        // make sure the field name is valid
        if(!this._filters[fieldName]){
            console.warn(`silently ignoring request to add filter for unknown field (${fieldName})`);
            return this;
        }
        
        // add the filter
        this._filters[fieldName].push(filterFn);
        
        // return a reference to self
        return this;
    }
    
    /**
     * A function get the filter functions that should be applied to any given
     * field.
     * 
     * @param {string} fieldName - one of `'url'`, `'text'`, or
     * `'description'`.
     * @returns {function[]} returns an array of callbacks, which may be empty.
     * an empty array is returned if an invalid field name is passed.
     */
    filtersFor(fieldName){
        fieldName = String(fieldName);
        let ans = [];
        
        if(this._filters[fieldName]){
            if(fieldName !== 'all'){
                for(let f of this._filters.all){
                    ans.push(f);
                }
            }
            for(let f of this._filters[fieldName]){
                ans.push(f);
            }
        }
        return ans;
    }
}

/**
 * Register a data transformer function for a given domain.
 *
 * @param {string} domain
 * @param {function} transformerFn
 */
module.exports.registerTransformer = function(domain, transformerFn){
    // TO DO - add validation
    
    let fqdn = String(domain);
    if(!fqdn.match(/[.]$/)){
        fqdn += '.';
    }
    perDomainPageDataToLinkDataTransmformers[fqdn] = transformerFn;
};

/**
 * Get the data transformer function for a given domain.
 *
 * @param {string} domain
 * @returns {function}
 */
module.exports.getTransformerForDomain = function(domain){
    // TO DO - add validation
    
    let fqdn = String(domain);
    if(!fqdn.match(/[.]$/)){
        fqdn += '.';
    }
    
    // return the most exact match
    while(fqdn.match(/[.][^.]+[.]$/)){
        if(perDomainPageDataToLinkDataTransmformers[fqdn]){
            //console.log(`returning transformer for '${fqdn}'`);
            return perDomainPageDataToLinkDataTransmformers[fqdn];
        }
        //console.log(`no transformer found for '${fqdn}'`);
        fqdn = fqdn.replace(/^[^.]+[.]/, '');
    }
    //console.log('returning default transformer');
    return perDomainPageDataToLinkDataTransmformers['.'];
};

/**
 * Register a template.
 *
 * @param {string} name
 * @param {module:@bartificer/linkify.LinkTemplate} template
 */
module.exports.registerTemplate = function(name, template){
    // TO DO - add validation
    
    linkTemplates[name] = template;
};

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
 * @param {string} [templateName='html']
 * @returns {string}
 */
module.exports.generateLink = async function(url, templateName){
    // TO DO - add validation
    
    let tplName = templateName && typeof templateName === 'string' ? templateName : 'html';
    
    // get the page data
    let pData = await this.fetchPageData(url);
    
    // transform the page data to link data
    let lData = module.exports.getTransformerForDomain(pData.uri().hostname())(pData);
    
    // render the link
    return Mustache.render(linkTemplates[tplName].templateString(), lData.asPlainObject());
};

//
//=== Create and register the default templates ===============================
//

module.exports.registerTemplate(
    'html',
    new module.exports.LinkTemplate('<a href="{{{url}}}" title="{{description}}">{{text}}</a>')
);
module.exports.registerTemplate(
    'htmlNewTab',
    new module.exports.LinkTemplate('<a href="{{{url}}}" title="{{description}}" target="_blank" rel="noopener">{{text}}</a>')
);
let markdownTpl = new module.exports.LinkTemplate('[{{{text}}}]({{{url}}})');
module.exports.registerTemplate('markdown', markdownTpl);