/**
 * @file The definition of the main Linkifier class which provides the link rendering functionality with the help of the other classes and modules.
 * @author Bart Busschots <opensource@bartificer.ie>
 * @license MIT
 */

/**
 * Linkifier's core link rendering functionality.
 * @module linkifier-class
 * @requires link-data
 * @requires link-template
 * @requires page-data
 * @requires node:fs/promises
 * @requires node:path
 * @requires node:os
 * @requires module:cheerio
 * @requires module:kleur
 * @requires module:node-fetch
 * @requires module:mustache
 * @requires module:title-case
 */
import { PageData } from './PageData.class.mjs';
import { LinkData } from './LinkData.class.mjs';
import { LinkTemplate } from './LinkTemplate.class.mjs';
import * as utilities from "./utilities.mjs";
import * as defaults from "./defaults.mjs";
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import kleur from 'kleur';
const { bold, italic, blue, green, grey, red } = kleur;
import Mustache from 'mustache';
import * as titleCase from 'title-case';

/**
 * The class providing the link rendering functionality. Instances of this class capture the settings for generating links, and, generate links using these settings.
 */
export class Linkifier {
    /**
     * The default values used for renderig links.
     * @type {Object}
     * @readonly
     * @see {@link module:defaults} for the list of defaults defined.
     */
    static get defaults() {
        return defaults;
    }

    /**
     * A suite of utility functions.
     * 
     * Note that for convenience, this same suite of functions is also available as an instance member.
     * @type {Object}
     * @readonly
     * @see {@link module:utilities} for the list of functions provided.
     */
    static get utilities(){
        return utilities;
    }

    /**
     * A function to try import a customised Linkfifier object and/or CLI options from a configuration module.
     * 
     * If no path is provided, tries to import from a standard file name in the user's home directory.
     * 
     * Paths are coerced to strings with `String()` and relative paths are resolved relative to the user's current working directory.
     * @param {string} [configPath] — an optional path to import the configuration from.
     * @returns {configurationObject} if no path is passed, and there is no module in the default location, an empty object will be returned.
     * @throws {TypeError} A TypeError is thrown if the loaded module does not export an object as `default`, the exported object contains a key named `linfifier` that is not an instance of the `Linkifier` class, or, a key named `options` that is not an object.
     * @throws {Error} An Error is thrown if a path is passed but a module can't be imported from it.
     * @see {@link module:defaults.configFilename} for the default file name used.
     */
    static async importConfig(configPath = ''){
        // determine the file path to try load from
        configPath = String(configPath); // coerce the path to a string
        const fallingBackToDefault = configPath === '';
        if(fallingBackToDefault){
            // build the default path
            configPath = path.join(os.homedir(), defaults.configFilename);
            utilities.debug(`no config path specified, falling back to standard: ${configPath}`);
        } else {
            // resolve the passed path so it is relative to the user's current working directory in the shell
            configPath = path.resolve(configPath);
        }
    
        // make sure the path exists
        try{
            utilities.debug(`checking read access to configuartion module path: ${configPath}`);
            await fs.access(configPath, fs.constants.R_OK);
        } catch (err){
            // only we're only trying as a fallback, don't throw an error, just return an empty object
            if(fallingBackToDefault){
                utilities.debug('failed read configuration module, returning default Linkifier and empty option list');
                return {
                    linkifier: new Linkifier(),
                    options: {}
                };
            }
    
            // a specific path was passed but it does not exist, throw an error
            utilities.debug(`${bold('Permission error:')} ${err.message}`);
            throw new Error('Configuration module not readable', { cause: err });
        }
    
        // try load the config
        let rawConfig = null;
        try {
            utilities.debug(`attempting to import configuration module from: ${configPath}`);
            //rawConfig = (await import(configPath)).default; // generates a webpack warning
            rawConfig = (await __non_webpack_require__(configPath)).default;
            if(typeof rawConfig == 'undefined'){
                utilities.debug(`${red('FAILED')} module does not provide an export named 'default'`);
                throw new Error(`failed to import configuration module from '${configPath}', does not provide an export named 'default'`);
            }
            utilities.debug(`${green('OK')} — configuration module imported`);
        } catch (err) {
            utilities.debug(`${red('FAILED')} with error: ${err.message}`);
            throw new Error('failed to import configuration module', { cause: err });
        }
    
        // extract and verify the expected information
        utilities.debug('validating imported configuration module');
        if(typeof rawConfig != 'object'){
            utilities.debug(`${red('FAILED')} 'default' import does not provide an object`);
            throw new TypeError(`'default' export of configuration module loaded from '${configPath}' is not an object`);
        }
        const config = {
            linkifier: null,
            options: {}
        };
        if(rawConfig.hasOwnProperty('linkifier')){
            if(rawConfig.linkifier instanceof Linkifier){
                config.linkifier = rawConfig.linkifier;
            } else {
                utilities.debug(`${red('FAILED')} configuration key 'linkifier' is not an instance of Linkifer`);
                throw new TypeError("Configuration key 'linkifier' must be an instance of the Linkifier class");
            }
        } else {
            config.linkifier = new Linkifier();
        }
        if(rawConfig.hasOwnProperty('options')){
            if(typeof config.options == 'object'){
                config.options = { ...rawConfig.options };
            } else {
                utilities.debug(`${red('FAILED')} configuration key 'options' is not an object`);
                throw new TypeError("Configuration key 'options' must be an object");
            }
        }
        utilities.debug(`${green('OK')} — imported configuration is valid`);
    
        // return the imported configuration
        return config;
    }

    /**
     * Builds a Linkifier instance ready for use rendering links using the default configration.
     * @see {@link module:defaults} for the default configuration settings.
     */
    constructor(){
        /**
         * A mapping of fully qualified domain names to data transformation functions.
         *
         * @private
         * @type {Object.<string, dataTransformer>}
         */
        this._pageDataToLinkDataTransmformers = {
            '.' : defaults.dataTransformer
        };

        /**
         * A mapping of fully qualified domain names to default template names.
         * 
         * @private
         * @type {Object.<string, string>}
         */
        this._pageDataToLinkTemplateName = {
            '.' : 'html' // default to the 'html' template for all domains unless otherwise specified
        };

        /**
         * The registered link templates.
         *
         * @private
         * @type {Object.<string, module:link-template.LinkTemplate>}
         */
        this._linkTemplates = {};

        /**
         * The loaded list of words with customised capitalisations.
         * 
         * @private
         * @type {Set<string>}
         * @see {@link module:defaults.speciallyCapitalisedWords} for the initial list of specially capitalised words.
         */
        this._speciallyCapitalisedWords = new Set();
        defaults.speciallyCapitalisedWords.map(word => this._speciallyCapitalisedWords.add(word));

        /**
         * The loaded list of small words for title case conversions with customised capitalisations.
         * 
         * Initialised with the default list of small words from the title-case module augmented with the additionall small words defined in the defaults module.
         * 
         * @private
         * @type {Set<string>}
         * @see {@link module:defaults.smallWords} for the additional small words added from the defaults module.
         * @see {@link module:title-case} for details of the title-case dependency.
         */
        this._smallWords = new Set([...defaults.importedSmallWords, ...defaults.extraSmallWords]);

        /**
         * A collection of utility functions.
         *
         * @private
         * @type {Object.<string, Function>}
         */
        this._utilities = utilities;

        //
        // -- Create and register the default templates --
        //
        for (const [name, template] of Object.entries(defaults.linkTemplates)) {
            this.registerTemplate(name, template);
        }
    }

    /**
     * A collection of utility functions, both used within the module's own code, and available for use when customising the module.
     * 
     * Note that for convenience, this same suite of functions is also available as a static member.
     * @type {Object.<string, Function>}
     * @readonly
     * @see {@link module:utilities} for the utility functions available in this collection.
     */
    get utilities() {
        return this._utilities;
    }

    /**
     * Shorthand property for `.utilities`.
     * @see {@link module:linkifier-class.Linkifier#utilities}
     */
    get util(){
        return this._utilities;
    }

    /**
     * The set of known of known words with special capitalisations.
     * 
     * Note that *'words'* can contain spaces, e.g. *'the US'* can be added as a word to avoid the word *'us'* being wrongly capitalised.
     * 
     * This list is initialised with the list of specially capitalised words from the defaults module.
     * @type {Set<string>}
     * @readonly
     * @see {@link module:defaults.speciallyCapitalisedWords} for the initial list of specially capitalised words.
     */
    get speciallyCapitalisedWords(){
        return this._speciallyCapitalisedWords;
    }

    /**
     * The set of known small words for title case conversions.
     * 
     * This list is initialised with the list of small words from the title-case module augmented with the additionall small words defined in the defaults module.
     * @type {Set<string>}
     * @readonly
     * @see {@link module:defaults.smallWords} for the additional small words added from the defaults module.
     * @see {@link module:title-case} for details of the title-case dependency.
     */
    get smallWords(){
        return this._smallWords;
    }

    /**
     * The registered mappings from domain names to data transformers.
     * @readonly
     * @type {Object<string, dataTransformer>}
     */
    get domainToTransformerMappings(){
        return {...this._pageDataToLinkDataTransmformers};
    }

    /**
     * Register a data transformer function to a domain name.
     *
     * @param {string} domain - The fully qualified domain for which this transformer should be
     * used.
     * @param {dataTransformer} transformerFn - The data transformer callback.
     */
    registerTransformer(domain, transformerFn){
        // TO DO - add validation
    
        let fqdn = String(domain);
        if(!fqdn.match(/[.]$/)){
            fqdn += '.';
        }
        this._pageDataToLinkDataTransmformers[fqdn] = transformerFn;
    }

    /**
     * Get the data transformer function for a given domain.
     *
     * Note that domains are searched from the subdomain up. For example, if passed
     * the domain `www.bartificer.ie` the function will first look for a
     * transformer for the domain `www.bartificer.ie`, if there's no transformer
     * registered for that domain it will look for a transformer for the domain
     * `bartificer.ie`, if there's no transformer for that domain either it will
     * return the default transformer.
     *
     * @param {string} domain - The fully qualified domain for which to get the data transformer.
     * @returns {dataTransformer}
     */
    getTransformerForDomain(domain){
        // TO DO - add validation
    
        let fqdn = String(domain);
        if(!fqdn.match(/[.]$/)){
            fqdn += '.';
        }
    
        // return the most exact match
        while(fqdn.match(/[.][^.]+[.]$/)){
            if(this._pageDataToLinkDataTransmformers[fqdn]){
                //console.log(`returning transformer for '${fqdn}'`);
                return this._pageDataToLinkDataTransmformers[fqdn];
            }
            //console.log(`no transformer found for '${fqdn}'`);
            fqdn = fqdn.replace(/^[^.]+[.]/, '');
        }
        //console.log('returning default transformer');
        return this._pageDataToLinkDataTransmformers['.'];
    }

    /**
     * A list of the names of the registered link templates.
     * @type {string[]}
     * @readonly
     */
    get templateNames() {
        return Object.keys(this._linkTemplates);
    }

    /**
     * The name of the default template used when rendering links.
     * @type {string}
     * @throws {TypeError} A validation error is thrown if the template name is missing, invalid, or doesn't correspond to a registered template.
     */
    get defaultTemplateName(){
        return this._pageDataToLinkTemplateName['.'];
    }
    set defaultTemplateName(templateName){
        const tplName = String(templateName);
        if(!this._linkTemplates[tplName]){
            throw new TypeError(`No template named '${tplName}' is registered`);
        }
        this._pageDataToLinkTemplateName['.'] = tplName;
    }
    
    /**
     * The default link template.
     * @type {module:link-template.LinkTemplate}
     * @readonly
     */
    get defaultTemplate(){
        return this._linkTemplates[this._pageDataToLinkTemplateName['.']];
    }

    /**
     * Check whether or not a template is registered with the given name
     * @param {string} tplName - the template name to check.
     * @returns {boolean}
     */
    hasTemplate(tplName){
        tplName = String(tplName);
        return this._linkTemplates.hasOwnProperty(tplName);
    }

    /**
     * The mappings of domain names to default template names.
     * @readonly
     * @type {Object<string, string>}
     */
    get domainToDefaultTemplateNameMappings(){
        return {...this._pageDataToLinkTemplateName};
    }

    /**
     * Register a link template.
     *
     * @param {string} name
     * @param {module:link-template.LinkTemplate} template
     * @throws {TypeError} if invalid arguments are passed
     */
    registerTemplate(name, template){
        if(!name) throw new TypeError('name required');
        const tplName = String(name); // coerce to string
        if(! template instanceof LinkTemplate) throw new TypeError('template must be an instance of LinkTemplate');
    
        this._linkTemplates[tplName] = template;
    }

    /**
     * Get a registered link template by name.
     *
     * @param {string} templateName
     * @returns {module:link-template.LinkTemplate}
     * @throws {TypeError} A validation error is thrown unless a valid name is passed and corresponds to a registered template.
     */
    getTemplate(templateName){
        const tplName = String(templateName);

        if(!this._linkTemplates[tplName]){
            throw new TypeError(`No template named '${tplName}' is registered`);
        }
        return this._linkTemplates[tplName];
    }

    /**
     * Register a default template for use with a given domain. This template will
     * override the overall default for this domain and all its subdomains.
     *
     * @param {string} domain - The fully qualified domain name for which this template should be used by default.
     * @param {string} templateName - The name of the template to use.
     */
    registerDefaultTemplateMapping(domain, templateName){
        // TO DO - add validation
    
        let fqdn = String(domain);
        if(!fqdn.match(/[.]$/)){
            fqdn += '.';
        }
        this._pageDataToLinkTemplateName[fqdn] = templateName;
    }

    /**
     * Get the template name for a given domain.
     *
     * Note that domains are searched from the subdomain up. For example, if passed
     * the domain `www.bartificer.ie` the function will first look for a
     * template for the domain `www.bartificer.ie`, if there's no template
     * registered for that domain it will look for a template for the domain
     * `bartificer.ie`, if there's no template for that domain either it will
     * return the default template.
     *
     * @param {string} domain - The fully qualified domain name to get the template for.
     * @returns {string}
     */
    getTemplateNameForDomain(domain){
        // TO DO - add validation
    
        let fqdn = String(domain);
        if(!fqdn.match(/[.]$/)){
            fqdn += '.';
        }
    
        // return the most exact match
        while(fqdn.match(/[.][^.]+[.]$/)){
            if(this._pageDataToLinkTemplateName[fqdn]){
                let tplName = this._pageDataToLinkTemplateName[fqdn];

                // make sure the template exists
                if(!this._linkTemplates[tplName]){
                    utilities.warn(`No template named '${tplName}' is registered, falling back to global default '${this._pageDataToLinkTemplateName['.']}'`);
                    return this._pageDataToLinkTemplateName['.'];
                }

                //console.log(`returning template name for '${fqdn}'`);
                return this._pageDataToLinkTemplateName[fqdn];
            }
            //console.log(`no template name found for '${fqdn}'`);
            fqdn = fqdn.replace(/^[^.]+[.]/, '');
        }
        //console.log('returning default template name');
        return this._pageDataToLinkTemplateName['.'];
    }

    /**
     * Get the template for a given domain.
     *
     * Note that domains are searched from the subdomain up. For example, if passed
     * the domain `www.bartificer.ie` the function will first look for a
     * template for the domain `www.bartificer.ie`, if there's no template
     * registered for that domain it will look for a template for the domain
     * `bartificer.ie`, if there's no template for that domain either it will
     * return the default template.
     *
     * @param {string} domain - The fully qualified domain name to get the template for.
     * @returns {string}
     */
    getTemplateForDomain(domain){
        return this.getTemplate(this.getTemplateNameForDomain(domain));
    }

    /**
     * Fetch the page data for a given URL.
     *
     * @async
     * @param {string} url - The URL to fetch the page data for.
     * @param {extraFieldsExtractorFunction} [extraFieldsExtractor] - An optional function to extract additional fields from the web page DOM object.
     * @returns {module:page-data.PageData}
     * @throws {TypeError} A TypeError is thrown if the URL is missing or invalid, or if the extraFieldsExtractor is provided but is not a function.
     * @throws {Error} An Error is thrown if the page source cannot be fetched and an extraFieldsExtractor is provided (can't fall back to reversing the URL slug). Any errors thrown by the field extractor, if present, are also re-thrown.
     */
    async fetchPageData(url, extraFieldsExtractor){
        // TO DO - add validation
        
        let ans = new PageData(url);
        
        // then try load the contents form the web
        let webDownloadResponseBody = '';
        try {
            let webDownloadResponse = await fetch(url);
            if(!webDownloadResponse.ok){
                throw new Error(`HTTP ${webDownloadResponse.status}: ${webDownloadResponse.statusText}`);
            }
            webDownloadResponseBody = await webDownloadResponse.text();
        } catch (err) {
            // if we have an extra field extractor, we can't fall back, so re-throw the error.
            if(typeof extraFieldsExtractor === 'function') {
                const msg = "Failed to fetch page source when extra field extraction is needed, cannot fall back to reversing the URL slug";
                utilities.error(`${msg}: ${err.message}`);
                throw new Error(msg, { cause: err });
            }

            // fall back to extracting the title from the URL slug
            utilities.warn(`Falling back to de-slugifying URL (${err.message})`);
            ans.title = this.utilities.extractSlug(url, this.speciallyCapitalisedWords, this.smallWords) || 'Untitled';
            return ans;
        }
        let $ = cheerio.load(webDownloadResponseBody);
        ans.title = $('title').text().trim();
        const metadata = PageData.emptyPageMetadataObject;
        const rawMetadata = {};
        $('meta[name]').each(function(){
            const $meta = $(this);
            rawMetadata[$meta.attr('name')] = $meta.attr('content');
        });
        for(const metadataKey of Object.keys(metadata)){
            metadata[metadataKey] = rawMetadata.hasOwnProperty(metadataKey) ? rawMetadata[metadataKey] : '';
        }
        ans.metadata = metadata;
        $('h1').each(function(){
            ans.h1($(this).text().trim());
        });
        $('h2').each(function(){
            ans.h2($(this).text().trim());
        });

        // if an extra fields extractor is provided, use it to extract the extra fields and add them to the page data object
        if(typeof extraFieldsExtractor === 'function'){
            try {
                ans.extraFields = extraFieldsExtractor($);
            } catch (err) {
                const msg = "An error occurred while extracting extra fields from the page DOM";
                utilities.error(`${msg}: ${err.message}`);
                throw new Error(msg, { cause: err });
            }
        }

        // return the answer
        return ans;
    }

    /**
     * Transform a given `PageData` object into a `LinkData` object using the appropriate transformer.
     * @param {module:page-data.PageData} pageData - the page data to transform.
     * @returns {module:link-data.LinkData}
     * @throws {TypeError} A TypeError is thrown if parameters are missing or invalid.
     * @throws {Error} An Error is thrown if there is a problem applying the registered transformer.
     * @see {@link dataTransformer}
     */
    transformPageData(pageData){
        // validate the arguments
        if(!pageData instanceof PageData){
            throw new TypeError('PageData object required');
        }

        // try transform the page data to link data
        let linkData = null;
        try {
            linkData = this.getTransformerForDomain(pageData.uri.hostname())(pageData);
            // pass through any extra fields that may exist
            linkData.extraFields = pageData.extraFields;
        } catch (err) {
            const msg = "An error occurred while transforming the page data to link data";
            utilities.error(`${msg}: ${err.message}`);
            throw new Error(msg, { cause: err });
        }

        // return the generated LinkData object
        return linkData;
    }

    /**
     * Render a link given a `LinkData` object and a template name or `LinkTemplate` object.
     * @param {module:link-data.LinkData} lData - the information about the link.
     * @param {module:link-template.LinkTemplate|string} tpl - a the tempalte to use, as an actualy object, or a name.
     * @returns {string} The rendered link.
     * @throws {TypeError} A TypeError is thrown if parameters are missing or invalid.
     */
    renderLink(linkData, tpl){
        // validate args
        if(!linkData instanceof LinkData){
            throw new TypeError('LinkData object required');
        }
        if(!tpl){
            throw new TypeError('template object or name required');
        }

        // resolve the template
        let template = null;
        if(tpl instanceof LinkTemplate){
            template = tpl;
        } else {
            // assume a template name, so coerce to string and try retreive
            tpl = String(tpl);
            template = this.getTemplate(tpl); // throws TypeError
        }

        // try apply the template field filters to the link data
        const fieldNames = LinkData.standardFieldNames;
        let templateData = {};
        try {
            // apply the field-specific filters to the appropriate standard link data fields
            templateData = linkData.asPlainObject();
            for(let fieldName of fieldNames){
                let fieldFilters = template.filtersFor(fieldName);
                for(let filterFn of fieldFilters){
                    templateData[fieldName] = filterFn(templateData[fieldName]);
                }
            }

            // apply the universal filters to all the standard link data fields
            let globalFilters = template.filtersFor('all');
            for(let filterFn of globalFilters){
                for(let fieldName of fieldNames){
                    templateData[fieldName] = filterFn(templateData[fieldName]);
                }
            }
        } catch (err) {
            const msg = "An error occurred while applying the template's field filters to the standard link data fields";
            utilities.error(`${msg}: ${err.message}`);
            throw new Error(msg, { cause: err });
        }

        // try render the link
        try {
            return Mustache.render(template.templateString, templateData);
        } catch (err) {
            const msg = "An error occurred while rendering the template";
            utilities.error(`${msg}: ${err.message}`);
            throw new Error(msg, { cause: err });
        }
    }

    /**
     * Generate a link given a URL. By default the registered template for the
     * URL's domain will be used, or, if none is registered, the overall
     * default will be used (`html`).
     *
     * @async
     * @param {string} url
     * @param {string} [templateName] - An optional template name to override the normal template resolution process. The value passed must correspond to a registered template name, and will be coerced to a string with `String(templateName)`.
     * @returns {string} The generated link.
     * @throws {TypeError} A TypeError is thrown if the URL is missing or invalid.
     * @throws {TypeError} A TypeError is thrown if a template name is passed but is invalid or doesn't correspond to a registered template.
     * @throws {Error} An error is thrown if the resolved template supports extra fields but the page source cannot be fetched, or, if the templates's extra field extractor function throws an error, or, if the link data transformation fails.
     */
    async generateLink(url, templateName){
        // TO DO - add validation

        //
        // -- resolve the template name to use for this URL --
        //

        // default to any passed template name, otherwise resolve the default for this URL's domain
        let tplName = templateName ? String(templateName) : '';

        // if no template name was passed, resolve the default for the URL's domain
        if(!tplName){
            tplName = this.getTemplateNameForDomain((new URL(url)).hostname);
        }

        // make sure the template exists before storing the resolved template
        if(!this._linkTemplates[tplName]){
            const msg = `No template named '${tplName}' is registered`;
            utilities.error(msg);
            throw new TypeError(msg);
        }
        const template = this._linkTemplates[tplName];
        
        // get the page data
        const pageData = await this.fetchPageData(url, template.hasExtraFields ? template.fieldExtractor : null); // throws errors — allow them to pass through
        
        // try transform the page data to link data
        const linkData = this.transformPageData(pageData); // throws Errors
        
        // try render the link
        return this.renderLink(linkData, template);
    }
};