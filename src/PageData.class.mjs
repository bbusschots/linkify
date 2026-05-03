/**
 * @file Data model for web page information.
 * @author Bart Busschots <opensource@bartificer.ie>
 * @license MIT
 */

/**
 * This module provides the class for representing the information that is extracted from web pages.
 * @module page-data
 * @requires module:urijs
 */
import {default as URI} from 'urijs';

/**
 * The information extracted from web pages that can be used to render a link.
 * 
 * Instances of this class are created from the information extracted from web pages and converted to link information by data transformers before being rendered to links via templates.
 * @see {@link dataTransformer} for details of how instances of this class are used in the link generation process.
 */
export class PageData {
    /**
     * A new empty page metadata object.
     * @readonly
     * @type {pageMetadataObject}
     */
    static get emptyPageMetadataObject(){
        return {
            author: '',
            creator: '',
            description: '',
            keywords: [],
            publisher: ''
        };
    }

    /**
     * @param {string} url - The page's full URL.
     */
    constructor(url){
        // TO DO - add validation
        
        /**
         * The page's URL as a URI object.
         *
         * @private
         * @type {module:urijs}
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
         * The page's header metadata
         * 
         * @private
         * @type {pageMetadataObject}
         */
        this._metadata = PageData.emptyPageMetadataObject;
        
        /**
         * The section headings on the page as arrays of strings indexed by
         * `h1` and `h2`.
         * 
         * @private
         * @type {Object}
         * @property {string[]} h1 - The page's top-level headings (`h1` tags).
         * @property {string[]} h2 - The page's secondary headings (`h2` tags).
         */
        this._headings = {
            h1: [],
            h2: []
        };

        /**
         * An object to hold any extra fields extracted from the page by a field extractor function, indexed by field name.
         * @type {Object.<string, string>}
         * @private
         */
        this._extraFields = {};

        // store the URL using the public setter to ensure it's stored as a URI object
        this.url = url;
    }
    
    /**
     * @type {string}
     * @throws {TypeError} on invalid URLs.
     */
    get url(){
        return this._uri.toString();
    }
    set url(url){
        this._uri = URI(url).normalize();
    }
    
    /**
     * @type {module:urijs}
     * @readonly
     */
    get uri(){
        return this._uri.clone();
    }
    
    /**
     * The domain-part of the URL.
     * @type {string}
     * @readonly
     */
    get domain(){
        return this._uri.hostname();
    }
    
    /**
     * The path-part of the URL.
     * @type {string}
     * @readonly
     */
    get path(){
        return this._uri.path();
    }
    
    /**
     * The page's title. Values are coerced to strings with `String(title)`.
     * @type {string}
     */
    get title(){
        return this._title;
    }
    set title(title){
        this._title = String(title);
    }

    /**
     * The page's metadata from the page's HTML header.
     * 
     * When getting this property a shallow clone of the internal metadata fields object is returned.
     * 
     * When setting this property a comma-separated string can be passed for the keywords. All values passed are coerced to strings with `String()` before being written to the internal data structure.
     * 
     * Note that reading this property produces a shallow clone of the internal metadata fields object, and that the values set for metadata fields are coerced to strings with `String(value)`.
     * @type {pageMetadataObject}
     * @throws {TypeError} if an attempt is made to set this property to a non-object value.
     */
    get metadata(){
        return {
            author: this._metadata.author,
            creator: this._metadata.creator,
            description: this._metadata.description,
            keywords: [...this._metadata.keywords], // shallow clone is OK since the values are coerced to strings by the setter
            publisher: this._metadata.publisher
        }
    }
    set metadata(metadata){
        if(typeof metadata === 'object' && metadata !== null){
            this._metadata.author = metadata.author ? String(metadata.author) : '';
            this._metadata.creator = metadata.creator ? String(metadata.creator) : '';
            this._metadata.description = metadata.description ? String(metadata.description) : '';
            if(typeof metadata.keywords == 'string' && metadata.keywords.length > 0){
                this._metadata.keywords = metadata.keywords.split(/,[ ]*/); // split keyword lists on commas
            } else if(metadata.keywords && Array.isArray(metadata.keywords)){
                this._metadata.keywords = [...metadata.keywords.map((keyword) => { String(keyword) })];
            } else {
                this._metadata.keywords = [];
            }
            this._metadata.publisher = metadata.publisher ? String(metadata.publisher) : ''
        } else {
            throw new TypeError('metadata must be a dictionary object with string keys and string values, except for the key keywords which should be an array of strings');
        }
    }
    
    /**
     * The page's primary and secondary headings.
     * @type {Object}
     * @property {string[]} h1 - The page's top-level headings (`h1` tags).
     * @property {string[]} h2 - The page's secondary headings (`h2` tags).
     * @readonly
     */
    get headings(){
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
     * The page's top-level headings (`h1` tags).
     * @type {string[]}
     * @readonly
     */
    get topLevelHeadings(){
        var ans = [];
        for(let h of this._headings.h1){
            ans.push(h);
        }
        return ans;
    }

    /**
     * An alias for `.topLevelHeadings`.
     * @readonly
     * @see {@link module:page-data.PageData#topLevelHeadings}
     */
    get h1s(){
        return this.topLevelHeadings;
    }

    /**
     * The page's secondary headings (`h2` tags).
     * @type {string[]}
     * @readonly
     */
    get secondaryHeadings(){
        var ans = [];
        for(let h of this._headings.h2){
            ans.push(h);
        }
        return ans;
    }

    /**
     * An alias for `.secondaryHeadings`.
     * @readonly
     * @see {@link module:page-data.PageData#secondaryHeadings}
     */
    get h2s(){
        return this.secondaryHeadings;
    }

    /**
     * The text from the most important heading on the page. If the page
     * has `h1` tags, the first one will be used, if not, the first `h2` tag
     * will be used, and if there's none of those either, an empty string will
     * be returned.
     * @type {string}
     * @readonly
     */
    get mainHeading(){
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
     * @returns {module:page-data.PageData} A reference to self to 
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
     * @returns {module:page-data.PageData} A reference to self to 
     * facilitate function chaning.
     */
    addSecondaryHeading(h2Text){
        // TO DO - add argument validation
        this._headings.h2.push(h2Text);
        return this;
    }

    /**
     * The extra fields extracted from the page by a field extractor function, indexed by field name. If no field extractor was used, this will be an empty object.
     * 
     * Note that reading this property produces a shallow clone of the internal extra fields object, and that the values set for extra fields are coerced to strings with `String(value)`.
     * @type {Object.<string, string>}
     * @default {}
     * @throws {TypeError} if an attempt is made to set this property to a non-object value.
     */
    get extraFields(){
        return { ...this._extraFields }; // shallow clone is OK since values are coerced to strings by the setter
    }
    set extraFields(extraFields){
        if(typeof extraFields === 'object' && extraFields !== null){
            for (let [key, value] of Object.entries(extraFields)) {
                this._extraFields[String(key)] = String(value);
            }
        } else {
            throw new TypeError('extraFields must be a dictionary object with string keys and string values');
        }
    }

    /**
     * Add an extra field to the page data object.
     * 
     * Note that values are coerced to strings with `String(value)`.
     * @param {string} fieldName - The name of the field to add.
     * @param {string} value - The value of the field to add. This will be coerced to a string with `String(value)`.
     * @returns {module:page-data.PageData} A reference to self to facilitate function chaning.
     */
    addExtraField(fieldName, value){
        this._extraFields[String(fieldName)] = String(value);
        return this;
    }

    /**
     * Get the page data as a plain object.
     * @returns {plainPageInformationObject}
     */
    asPlainObject(){
        let ans = {
            url: this.url,
            title: this.title,
            metadata: this.metadata,
            topLevelHeadings: this.topLevelHeadings,
            secondaryHeadings: this.secondaryHeadings,
            mainHeading: this.mainHeading,
            extraFields: this.extraFields,
            uri: URI.parse(this._uri.toString())
        };
        ans.uri.hasPath = ans.uri.path !== '/';
        return ans;
    }
};

/**
 * A shortcut for `.addTopLevelHeading()`.
 * @name module:page-data.PageData#h1
 * @function
 * @see {@link module:page-data.PageData#addTopLevelHeading}
 * 
 */
PageData.prototype.h1 = PageData.prototype.addTopLevelHeading;

/**
 * A shortcut for `.addSecondaryHeading()`.
 * @name module:page-data.PageData#h2
 * @function
 * @see {@link module:page-data.PageData#addSecondaryHeading}
 * 
 */
PageData.prototype.h2 = PageData.prototype.addSecondaryHeading;