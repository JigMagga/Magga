'use strict';

var immutable = require('immutable'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    path = require('path'),
    fs = require('fs');




/**
 * @name MaggaConfig
 *
 * @type {{
 *   getFilePath : Function
 *   extension : Array
 *   extend : boolean
 *   execute : boolean
 *   basePath : string
 *   placeholders : Object
 * }}
 */


/**
 * create instance of magga
 *
 * @param {MaggaConfig} config - incoming config
 * @constructor
 */
function Magga(config) {
    EventEmitter.call(this);

    this.emit('start', config);

    config = config || {};
    config.cwd = path.resolve(config.cwd || process.cwd());
    // extention for configuration files
    config.extension = config.extension || ".conf";
    config.basePath = config.basePath || __dirname;
    //config.getFilePath = config.getFilePath || getFilePath;
    //config.getFilePath = config.getFilePath.bind(null, config);

    this._config = immutable.fromJS(config || {});
}

/**
 * Use EventEmitter
 */
util.inherits(Magga, EventEmitter);



Magga.jigToPath = function (jigName) {
    return jigName.replace(/\./g, "/").replace(/\/([^/]*)$/, "/$1/$1.js").toLowerCase();
};


/**
 * creates instance of Magga if non existent, and returns it
 *
 * @param {Object|undefined} config - for Magga constructor
 * @returns {Object} singleton - instance of Magga
 */

Magga.getInstance = function (config) {

    // return instance of magga if exists, create it also if not.
    if (!this.singleton) {
        this.singleton = new Magga(config);
    }

    // extend _config, if extension given
    if (config && this.singleton) {
        this.singleton.config(config);
    }

    return this.singleton;
};


/**
 *
 * Merges extension with private variable _config in magga object and singleton
 *
 * @param {Object|undefined} extension - updates _config
 * @returns {any} void function
 */

Magga.prototype.config = function (extension) {
    if (!extension) {
        return this._config;
    }
    return this._config = this._config.merge(extension);
};


/**
 * CreateFactory requires a config file, parses the jig's names, and returns a function maggaApp,
 * that will require every /yg/jig/jigName when called in Magga.render()
 *
 * @param {String|Object} pageConfig - configuration as path or object
 * @returns {function} factory - will require all files when passed into Magga.render(maggaApp, fn)
 *
 */
Magga.prototype.createFactory = function (pageConfig) {

    var config = typeof pageConfig === 'object' ? pageConfig : JSON.parse(fs.readFileSync(pageConfig, {encoding: 'utf-8'})),
        jigs = Object.keys(config.jigs),
        requiredJigs = {},
        i, len,
        factory,
        _Magga = Magga;

    for (i = 0, len = jigs.length; i < len; i++) {
        requiredJigs[jigs[i]] = require(_Magga.jigToPath(jigs[i]));
    }

    factory = function () {
        return {"config": config, "keys": jigs, jigs: requiredJigs};
    };
    return factory;
};

// TODO: should render function have the possibility to enter extra data?
/**
 *
 * @param {String} pagePath - path to the main template
 * @param {Object} data - object with predefined data that should be bootstraped to the page
 * @param {Function} callback - cb function
 * @returns {any} nothing to return

 Magga.prototype.render = function (pagePath, data, callback) {};
 */
/**
 * creates an instance of every jig
 *
 * @param {function} factory - requires files needed to create instances of jigs
 * @param {function} callback       - callback when async task is done
 * @returns {any}    nothing to return
 */

Magga.prototype.render = function (factory, callback) {
    var self = this,
        configInfo = factory(),
        config = configInfo.config, // container for jig's default objects
        keys = configInfo.keys, // jigName to call constructor
        jigs = configInfo.jigs, // jig constructor
        Jig;

    self.pageConfig = config;

    keys.map(function (jigName) {
        // Create multiple instances of Jig
        if (config.jigs[jigName] instanceof Array) {
            config.jigs[jigName].map(function (defaults) {
                Jig = jigs[jigName];
                if (config.jigs[jigName].init !== false) {
                    new Jig(defaults);
                }


            });

        }
        // Create only one instance of Jig
        else {
            Jig = jigs[jigName];
            if (config.jigs[jigName].init !== false) {
                new Jig(config.jigs[jigName].defaults);
            }
        }
    });
    if (typeof callback === "function") {
        callback();
    }
};


/**
 * Returns the pageConfig from which the bundle is created.
 * @returns {String|*}
 *
 */
Magga.prototype.getPageConfig = function () {
    return this.pageConfig;
};


/**
 * This will extend the Magga with some functions
 * You can use a function that will be called with the instance:
 *
 * Magga.use(function(MaggaInstance){
 *
 *   MaggaInstance.myFn = function(){}
 *
 * })
 *
 * Or you use an object that will be extend to the root
 *
 * Magga.use({ myFn: function(){}})
 *
 * Use:
 *
 * Magga.myFn();
 *
 * @param {object|function} extension
 */
Magga.prototype.use = function (extension) {
    if (typeof extension === "function") {
        extension(this);
    } else if (typeof extension === "object") {
        util._extend(this, extension);
    } else {
        throw new Error("Wrong extension. Should be an object or function");
    }
};


/**
 * TODO WIP
 * @param {String} name - jig name eg. Jig
 * @param {String|Integer} id - specify an identifyer if there are many instances from one jig
 *
 * Many instances config eg.:
 *
 * jigs: {
 *
 *      "Jig.Todo.Button": [{
 *          id: "smartButton"
 *          init: false
 *          defaults: {}
 *      }, {
 *          id: "superSmartButton"
 *          init: false
 *          defaults: {}
 *      }]
 *
 *
 *
 * }
 *
 *
 *
 */
Magga.prototype.startJig = function (name, id) {
    var config = this.getPageConfig(),
        jigs = Object.keys(config.jigs),
        i, len;

    if (!name) {
        throw new Error("StartJig function requires name");
    }

    for (i = 0, len = jigs.length; i < len; i++) {
        if (jigs[i] === name) {
            if (config.jigs[name] instanceof Array) {
                if(!id){
                    throw new Error("StartJig function requires id in case of Jig: " + name);
                }
                // TODO
            } else {
                //config.jigs[name];
            }
        }
    }


};


module.exports = Magga;

