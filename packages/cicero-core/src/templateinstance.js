/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Logger = require('@accordproject/concerto-core').Logger;
const crypto = require('crypto');

const ParserManager = require('@accordproject/markdown-template').ParserManager;
const CiceroMarkTransformer = require('@accordproject/markdown-cicero').CiceroMarkTransformer;
const SlateTransformer = require('@accordproject/markdown-slate').SlateTransformer;
const TemplateMarkTransformer = require('@accordproject/markdown-template').TemplateMarkTransformer;
const HtmlTransformer = require('@accordproject/markdown-html').HtmlTransformer;

// For formulas evaluation
const ErgoEngine = require('@accordproject/ergo-engine/index.browser.js').EvalEngine;

const Util = require('./util');

/**
 * A TemplateInstance is an instance of a Clause or Contract template. It is executable business logic, linked to
 * a natural language (legally enforceable) template.
 * A TemplateInstance must be constructed with a template and then prior to execution the data for the clause must be set.
 * Set the data for the TemplateInstance by either calling the setData method or by
 * calling the parse method and passing in natural language text that conforms to the template grammar.
 * @public
 * @abstract
 * @class
 */
class TemplateInstance {
    /**
     * Create an instance
     * @param {number} instanceKind - the kind of instance (contract or clause)
     * @param {string} prefix - the instance prefix
     * @param {number} logicManager - the logic manager
     * @param {string} grammar - the initial grammar
     * @param {string} runtime - 'ergo' or 'es6'
     * @param {Template} [template] - the template for the instance
     */
    constructor(instanceKind, prefix, logicManager, grammar, runtime, template) {
        if (this.constructor === TemplateInstance) {
            throw new TypeError('Abstract class "TemplateInstance" cannot be instantiated directly.');
        }

        this.instanceKind = instanceKind;
        this.prefix = prefix;
        this.logicManager = logicManager;
        this.runtime = runtime;
        this.template = template;

        this.ciceroMarkTransformer = new CiceroMarkTransformer();
        this.templateMarkTransformer = new TemplateMarkTransformer();
        this.parserManager = new ParserManager(this.logicManager.getModelManager(), null, this.instanceKind);
        this.ergoEngine = new ErgoEngine();

        this.data = null;
        this.concertoData = null;

        // Initialize the parser
        Util.initParser(
            this.parserManager,
            this.logicManager,
            this.ergoEngine,
            this.prefix,
            this.instanceKind,
            grammar,
            this.runtime,
        );
    }

    /**
     * Set the data for the instance
     * @param {object} data  - the data for the clause, must be an instance of the
     * model. This should be a plain JS object
     * and will be deserialized and validated into the Concerto object before assignment.
     */
    setData(data) {
        // verify that data is an instance of the template model
        const contractModel = Util.getContractModel(this.logicManager, this.instanceKind);

        if (data.$class !== contractModel.getFullyQualifiedName()) {
            throw new Error(`Invalid data, must be a valid instance of the template model ${contractModel.getFullyQualifiedName()} but got: ${JSON.stringify(data)} `);
        }

        // downloadExternalDependencies the data using the template model
        Logger.debug('Setting clause data: ' + JSON.stringify(data));
        const serializer = this.logicManager.getModelManager().getSerializer();
        const resource = serializer.fromJSON(data);
        resource.validate();

        // save the data
        this.data = data;

        // save the concerto data
        this.concertoData = resource;
    }

    /**
     * Get the data for the clause. This is a plain JS object. To retrieve the Concerto
     * object call getConcertoData().
     * @return {object} - the data for the clause, or null if it has not been set
     */
    getData() {
        return this.data;
    }

    /**
     * Get the current Ergo engine
     * @return {object} - the data for the clause, or null if it has not been set
     */
    getEngine() {
        return this.ergoEngine;
    }

    /**
     * Get the data for the clause. This is a Concerto object. To retrieve the
     * plain JS object suitable for serialization call toJSON() and retrieve the `data` property.
     * @return {object} - the data for the clause, or null if it has not been set
     */
    getDataAsConcertoObject() {
        return this.concertoData;
    }

    /**
     * Set the data for the clause by parsing natural language text.
     * @param {string} input - the text for the clause
     * @param {string} [currentTime] - the definition of 'now', defaults to current time
     * @param {number} [utcOffset] - UTC Offset for this execution, defaults to local offset
     * @param {string} [fileName] - the fileName for the text (optional)
     */
    parse(input, currentTime, utcOffset, fileName) {
        // Setup
        const templateMarkTransformer = new TemplateMarkTransformer();

        // Transform text to ciceromark
        const inputCiceroMark = this.ciceroMarkTransformer.fromMarkdownCicero(input);

        // Set current time
        this.parserManager.setCurrentTime(currentTime, utcOffset);

        // Parse
        const data = templateMarkTransformer.dataFromCiceroMark({ fileName:fileName, content:inputCiceroMark }, this.parserManager, {});
        this.setData(data);
    }

    /**
     * Generates the natural language text for a contract or clause clause; combining the text from the template
     * and the instance data.
     * @param {*} [options] text generation options.
     * @param {string} [currentTime] - the definition of 'now', defaults to current time
     * @param {number} [utcOffset] - UTC Offset for this execution, defaults to local offset
     * @returns {string} the natural language text for the contract or clause; created by combining the structure of
     * the template with the JSON data for the clause.
     */
    draft(options, currentTime, utcOffset) {
        if(!this.concertoData) {
            throw new Error('Data has not been set. Call setData or parse before calling this method.');
        }

        const kind = this.instanceKind ? 'clause' : 'contract';

        // Get the data
        const data = this.getData();

        // Set current time
        this.parserManager.setCurrentTime(currentTime, utcOffset);

        // Draft
        const ciceroMark = this.templateMarkTransformer.draftCiceroMark(data, this.parserManager, kind, {});
        return this.formatCiceroMark(ciceroMark,options);
    }

    /**
     * Format CiceroMark
     * @param {object} ciceroMarkParsed - the parsed CiceroMark DOM
     * @param {object} options - parameters to the formatting
     * @param {string} format - to the text generation
     * @return {string} the result of parsing and printing back the text
     */
    formatCiceroMark(ciceroMarkParsed,options) {
        const format = options && options.format ? options.format : 'markdown_cicero';
        if (format === 'markdown_cicero') {
            if (options && options.unquoteVariables) {
                ciceroMarkParsed = this.ciceroMarkTransformer.unquote(ciceroMarkParsed);
            }
            const ciceroMark = this.ciceroMarkTransformer.toCiceroMarkUnwrapped(ciceroMarkParsed);
            return this.ciceroMarkTransformer.toMarkdownCicero(ciceroMark);
        } else if (format === 'ciceromark_parsed'){
            return ciceroMarkParsed;
        } else if (format === 'html'){
            if (options && options.unquoteVariables) {
                ciceroMarkParsed = this.ciceroMarkTransformer.unquote(ciceroMarkParsed);
            }
            const htmlTransformer = new HtmlTransformer();
            return htmlTransformer.toHtml(ciceroMarkParsed);
        } else if (format === 'slate'){
            if (options && options.unquoteVariables) {
                ciceroMarkParsed = this.ciceroMarkTransformer.unquote(ciceroMarkParsed);
            }
            const slateTransformer = new SlateTransformer();
            return slateTransformer.fromCiceroMark(ciceroMarkParsed);
        } else {
            throw new Error('Unsupported format: ' + format);
        }
    }

    /**
     * Returns the identifier for this instance. The identifier is the instance prefix
     * plus '-' plus a hash of the data for the instance (if set).
     * @return {String} the identifier of this instance
     */
    getIdentifier() {
        let hash = '';

        if (this.data) {
            const textToHash = JSON.stringify(this.getData());
            const hasher = crypto.createHash('sha256');
            hasher.update(textToHash);
            hash = '-' + hasher.digest('hex');
        }
        return this.prefix + hash;
    }

    /**
     * Returns the template for this clause
     * @return {Template} the template for this clause
     */
    getTemplate() {
        return this.template;
    }

    /**
     * Returns the instance kind
     * @return {number} the instance kind
     */
    getInstanceKind() {
        return this.instanceKind;
    }

    /**
     * Returns the template logic for this clause
     * @return {LogicManager} the template for this clause
     */
    getLogicManager() {
        return this.logicManager;
    }

    /**
     * Returns a JSON representation of the instance
     * @return {object} the JS object for serialization
     */
    toJSON() {
        return {
            template: this.prefix,
            data: this.getData()
        };
    }

    /**
     * To rebuild the parser when the grammar changes
     * @param {string} grammar - the new grammar
     */
    rebuildParser(grammar) {
        Util.rebuildParser(
            this.parserManager,
            this.logicManager,
            this.ergoEngine,
            this.prefix,
            grammar
        );
    }
}

module.exports = TemplateInstance;