const request = require('request-promise-native');
const cheerio = require('cheerio');
const URI = require('urijs');
const Mustache = require('mustache');
const vp = require('@maynoothuniversity/validate-params');
const v = vp.validateJS();

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
 * @type {Object.<FQDN, dataTransformer>}
 */
const pageDataToLinkDataTransmformers = {
    '.' : function(pData){
        let text = pData.title();
        if(pData.h1s().length === 1){
            text = pData.mainHeading();
        }
        return new module.exports.LinkData(pData.url(), text);
    }
}

/**
 * The registered link templates.
 *
 * @private
 * @type {Object.<templateName, module:@bartificer/linkify.LinkTemplate>}
 */
const linkTemplates = {};

/**
 * Data about a web page – including its URL, title, and headings.
 */
module.exports.PageData = class{
    /**
     * This constructor throws a {@link ValidationError} unless a valid URL is passed.
     *
     * @param {URL} url - The page's full URL.
     * @throws {ValidationError} A validation error is thrown if an invalid URL
     * is passed.
     */
    constructor(url){
        // TO DO - add validation
        
        /**
         * The page's URL as a URI object.
         *
         * @private
         * @type {URIObject}
         */
        this._uri = URI();
        
        /**
         * The page's title.
         * 
         * @private
         * @type {string}
         */
        this._title = '';
        
        /**
         * The section headings on the page as arrays of strings indexed by
         * `h1` and `h2`.
         * 
         * @private
         * @type {plainObject}
         */
        this._headings = {
            h1: [],
            h2: []
        };
        
        // store the URL
        this.url(url);
    }
    
    /**
     * Get or set the URL.
     *
     * @param {URL} [url] - A new URL as a string.
     * @returns {(string|module:@bartificer/linkify.PageData)} When in *get*
     * mode (passed no parameters), returns a URL string, when in *set* mode 
     * (passed a URL string as the first parameter), returns a reference to
     * self to facilitate function chaining.
     * @throws {ValidationError} A validation error is thrown if an argument
     * is passed that's not a valid URL string.
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
     * Get the URL as a URI.js object.
     *
     * @returns {URIObject}
     */
    uri(){
        return this._uri.clone();
    }
    
    /**
     * Get the domain-part of the URL as a string.
     * 
     * @returns {domainName}
     */
    domain(){
        return this._uri.hostname();
    }
    
    /**
     * Get the path-part of the URL.
     *
     * @returns {string}
     */
    path(){
        return this._uri.path();
    }
    
    /**
     * Get or set the page title.
     * 
     * @param {string} [title] - the page's title as a string.
     * @returns {(string|module:@bartificer/linkify.PageData)} When in *get*
     * mode (passed no parameters), returns the title, when in *set* mode 
     * (passed a string as the first parameter), returns a reference to self to
     * facilitate function chaining.
     * @throws {ValidationError} A validation error is thrown if an argument
     * is passed that's not a string.
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
     * Get the page's section headings as a plain object containing arrays of
     * strings indexed by `h1` and `h2`.
     * 
     * @returns {PlainObject}.
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
     * Get the page's top-level headings (`h1` tags).
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
     * Get the page's secondary headings (`h2` tags).
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
     * Get the text from the most important heading on the page. If the page
     * has `h1` tags, the first one will be used, if not, the first `h2` tag
     * will be used, and if there's none of those either, an empty string will
     * be returned.
     * 
     * @returns {string} Heading text as a string, or an empty string.
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
     * @returns {module:@bartificer/linkify.PageData} A reference to self to 
     * facilitate function chaning.
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
     * @returns {module:@bartificer/linkify.PageData} A reference to self to 
     * facilitate function chaning.
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
 * Data describing a link for use in link templates including a URL, link text,
 * and a description.
 */
module.exports.LinkData = class{
    /**
     * This constructor throws a {@link ValidationError} unless a valid URL is passed.
     *
     * @param {URL} url - The link's URL.
     * @param {string} [text] - The link's text, defaults to the URL.
     * @param {string} [description] - A description for the link, defaults to
     * the link text.
     * @throws {ValidationError} A validation error is thrown if an invalid URL
     * is passed.
     */
    constructor(url, text, description){
        // TO DO - add validation
        
        /**
         * The link's URL as a URI.js object.
         *
         * @private
         * @type {URIObject}
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
     * Get or set the URL.
     *
     * @param {URL} [url] - A new URL as a string.
     * @returns {(string|module:@bartificer/linkify.LinkData)} When in *get*
     * mode (passed no parameters), returns a URL string, when in *set* mode
     * (passed a URL string as the first parameter), returns a reference to 
     * self to facilitate function chaining. 
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
     * Get the URL as a URI.js object.
     * 
     * @returns {URIObject}
     */
    uri(){
        return this._uri.clone();
    }
    
    /**
     * Get or set the link text.
     * 
     * @param {string} [text] - New link text.
     * @returns {(string|module:@bartificer/linkify.LinkData)} When in *get*
     * mode (passed no parameters), returns the link text, when in *set* mode
     * (passed a string as the first parameter), returns a reference to self to
     * facilitate function chaining.
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
     * Get or set the link description.
     * 
     * @param {string} [description]
     * @returns {(string|module:@bartificer/linkify.LinkData)} When in *get* 
     * mode (passed no parameters), returns the link description, when in *set*
     * mode (passed a string as the first parameter), returns a reference to 
     * self to facilitate function chaining.
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
     * Get the link data as a plain object of the form:
     * ```
     * {
     *     url: 'http://www.bartificer.net/',
     *     text: 'the link text',
     *     description: 'the link description',
     *     uri: {
     *         hostname: 'www.bartificer.net',
     *         path: '/',
     *         hasPath: false
     *     }
     * }
     * ```
     *
     * Note that the `uri` could contain more fields - it's initialised with
     * output from the `URI.parse()` function from the `URI` module.
     * 
     * @returns {plainObject}
     * @see {@link https://medialize.github.io/URI.js/docs.html#static-parse}
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
 * A link template. The primary component of a template is a Moustache template
 * string.
 */
module.exports.LinkTemplate = class{
    /**
     * This constructor throws a {@link ValidationError} unless a template
     * string is passed.
     *
     * @param {templateString} templateString - A Moustache template string.
     * @param {Array} [filters=[]] - An optional array of filter functions.
     * Each element in the array should itself be an array where the first
     * element is a string specifying which fields the filter should be applied
     * to (one of `'all'`, `'url'`, `'text'`, or `'description'`), and the 
     * second the filter function itself which should be a function that takes
     * a single string as an argument and returns a filtered version of that
     * string
     * @throws {ValidationError} A validation error is thrown unless a template
     * string is passed.
     */
    constructor(templateString, filters){
        // TO DO - add validation
        
        /**
         * The Moustache template string.
         *
         * @private
         * @type {templateString}
         */
        this._templateString = '';
        this.templateString(templateString);
        
        /**
         * The filter functions to be applied to the various fields as a plain
         * object of arrays of {@filterFunction} callbacks indexed by:
         * * `all` — filters to be applied to all fields.
         * * `url` — filters to be applied to just the URL.
         * * `text` — filters to be applied just the link text.
         * * `description` — filters to be applied just the link description.
         *
         * @private
         * @type {Object.<string, filterFunction>}
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
     * Get or set the template string.
     *
     * @param {templateString} [templateString] - A new Moustache template
     * string.
     * @returns {(string|module:@bartificer/linkify.LinkTemplate)} When in
     * *get* mode (passed no parameters), returns the template string, when in
     * *set* mode (passed a string as the first parameter), returns a reference
     * to self to facilitate function chaining.
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
     * @param {string} fieldName - One of `'all'`, `'url'`, `'text'`, or
     * `'description'`.
     * @param {filterFunction} filterFn - the filter function.
     * @returns {module:@bartificer/linkify.LinkTemplate} Returns a reference
     * to self to facilitate function chaining.
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
     * @returns {filterFunction[]} returns an array of callbacks, which may be
     * empty. An empty array is returned if an invalid field name is passed.
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
 * @param {domainName} domain - The domain for which this transformer should be
 * used.
 * @param {dataTransformer} transformerFn - The data transformer callback.
 * @throws {ValidationError} A validation error is thrown if either parameter
 * is missing or invalid.
 */
module.exports.registerTransformer = function(domain, transformerFn){
    // TO DO - add validation
    
    let fqdn = String(domain);
    if(!fqdn.match(/[.]$/)){
        fqdn += '.';
    }
    pageDataToLinkDataTransmformers[fqdn] = transformerFn;
};

/**
 * Get the data transformer function for a given domain.
 *
 * Note that domains are searched from the subdomain up. For example, if passed
 * the domain `www.bartificer.net` the function will first look for a
 * transformer for the domain `www.bartificer.net`, if there's no transformer
 * registered for that domain it will look for a transformer for the domain
 * `bartificer.net`, if there's no transformer for that domain either it will
 * return the default transformer.
 *
 * @param {domainName} domain - The domain to get the data transformer for.
 * @returns {dataTransformer}
 * @throws {ValidationError} A validation error is thrown unless a valid domain
 * name is passed.
 */
module.exports.getTransformerForDomain = function(domain){
    // TO DO - add validation
    
    let fqdn = String(domain);
    if(!fqdn.match(/[.]$/)){
        fqdn += '.';
    }
    
    // return the most exact match
    while(fqdn.match(/[.][^.]+[.]$/)){
        if(pageDataToLinkDataTransmformers[fqdn]){
            //console.log(`returning transformer for '${fqdn}'`);
            return pageDataToLinkDataTransmformers[fqdn];
        }
        //console.log(`no transformer found for '${fqdn}'`);
        fqdn = fqdn.replace(/^[^.]+[.]/, '');
    }
    //console.log('returning default transformer');
    return pageDataToLinkDataTransmformers['.'];
};

/**
 * Register a link template.
 *
 * @param {templateName} name
 * @param {module:@bartificer/linkify.LinkTemplate} template
 * @throws {ValidationError} A validation error is thrown unless both a valid
 * name and template object are passed.
 */
module.exports.registerTemplate = function(name, template){
    // TO DO - add validation
    
    linkTemplates[name] = template;
};

/**
 * Fetch the page data for a given URL.
 *
 * @async
 * @param {URL} url
 * @returns {module:@bartificer/linkify.PageData}
 * @throws {ValidationError} A validation error is thrown unless a valid URL is
 * passed.
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
 * @param {URL} url
 * @param {templateName} [templateName='html']
 * @returns {string}
 * @throws {ValidationError} A validation error is thrown unless a valid URL is
 * passed.
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

// TO DO - document the default templates

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