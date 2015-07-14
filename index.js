'use strict';

var immutable    = require('immutable'),
    EventEmitter = require('events').EventEmitter,
    util         = require('util'),
    path         = require('path'),
    fs           = require('fs'),
    Promise      = require('bluebird'),
    _            = require('lodash'),
    b            = require('browserify'),
    browserify   = b(),
    gulp         = require('gulp'),
    source       = require('vinyl-source-stream'),
    rename       = require('gulp-rename'),
    es           = require('event-stream');


var files = Object.create(null),
    configCache = Object.create(null);

var readFile = Promise.promisify(fs.readFile);


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
 * default getFilePath function
 * @param {MaggaConfig} config - Magga configuration object
 * @param {String} pagePath - realtive page path
 * @returns {String} returns full file path
 */
var getFilePath = function (config, pagePath) {
    return path.join(config.basePath, pagePath);
};

var isPathAbsolute = function (filePath) {
    return /^(?:\/|[a-z]+:\/\/)/.test(filePath);
};

/**
 * returns array with paths to config file
 *
 * @param {String} basePath - base path method should look for configs until it reach this folder
 * @param {String} filePath - path to file for which method should generate the config
 * @returns {Array<String>} list with config file paths
 */
var getFoldersConfigPaths = function (basePath, filePath) {
    var removeLastPartFromPath = function (somePath) {
        var folders = somePath.split('/');
        folders.pop();
        return folders.join('/');
    };

    var loop = function (res, currentFolderPath) {
        var configFileName;
        if (basePath === currentFolderPath) {
            return res;
        }
        configFileName = _.first(currentFolderPath.split('/').reverse());

        res.push(path.join(currentFolderPath, configFileName + '.conf'));

        return loop(res, removeLastPartFromPath(currentFolderPath));
    };

    var fileFolderPath = removeLastPartFromPath(filePath);

    return loop([], fileFolderPath);
};

/**
 * read file and put the Promise to cache
 *
 * @param {string} filePath - path to file
 * @returns {Promise} promise with file content
 */
var readCachedFile = function (filePath) {
    if (files[filePath]) {
        return files[filePath];
    }

    files[filePath] = readFile(filePath, {encoding: 'utf-8'});

    return files[filePath];
};


var readFileIfExists = function (filePath) {
    return new Promise(function (reslove, reject) {
        readCachedFile(filePath)
            .then(function (res) {
                try {
                    res = JSON.parse(res);
                } catch (e) {
                    reject(new Error('config ' + filePath + ' is not a JSON'));
                }
                reslove(res);
            }, function (err) {
                if (err.code === 'ENOENT') {
                    return reslove({});
                }
                return reject(err);

            });
    });
};



var getResult = function (promise, cb) {
    if (!cb) {
        return promise;
    }

    promise
        .then(function (result) {
            cb(null, result);
        }, function (err) {
            cb(err);
        });
};


/**
 * create instance of magga
 *
 * @param {MaggaConfig} config - incoming config
 * @constructor
 */
function Magga(config) {
    EventEmitter.call(this);

    //this.emit('start', config);

    config = config || {};
    config.basePath = config.basePath || __dirname;
    config.getFilePath = config.getFilePath || getFilePath;
    config.getFilePath = config.getFilePath.bind(null, config);

    this._config = immutable.fromJS(config || {});
}

util.inherits(Magga, EventEmitter);

/**
 *
 * Merges extension with private variable _config in magga object and singleton
 *
 * @param {Object|undefined} extension - updates _config
 * @returns {any} void function
 */

Magga.prototype.config = function(extension){
    if (this.singleton){
        this.singleton._config = (this.singleton._config).merge(extension);
    }
    this._config =  (this._config).merge(extension);
};

/**
 * creates instance of Magga if non existent, and returns it
 *
 * @param {Object|undefined} extension - ext. for _config
 * @returns {Object} singleton - instance of magga
 */

Magga.prototype.getInstance = function(extension) {
    // extend _config, if extension given
    if (extension){
        this.config(extension);
    }
    // return instance of magga if exists, create it also if not.
    if (!this.singleton){
        this.singleton = new Magga(this._config);
    }
    return this.singleton;
};

/**
 * create config for some file and parse configs for it
 *
 * @param {string} pagePath - path to the page
 * @param {Function} callback - the result callback
 *
 * @returns {Object} return config
 */
Magga.prototype.getConfig = function getConfig(pagePath, callback) {
    var filePath = this._config.get('getFilePath')(pagePath);
    var configPaths = getFoldersConfigPaths(this._config.get('basePath'), filePath);

    if (configCache[filePath]) {
        return getResult(configCache[filePath].promise, callback);
    }

    configCache[filePath] = {};
    configCache[filePath].promise = Promise.all(configPaths.reverse().map(function (configPath) {
        return readFileIfExists(configPath);
    })).then(function (results) {
        var result = results.reduce(function (accumulator, currentConfig) {
            this.emit('extend', accumulator, currentConfig);
            return _.merge(accumulator, currentConfig);
        }.bind(this), {});

        result.configFilePath = filePath;
        this.emit('done', result);
        return immutable.fromJS(result);
    }.bind(this));

    return getResult(configCache[filePath].promise, callback);
};

/**
 *
 * @param {Object} config
 * @param {Object} placeholders
 * @returns {any}
 */
Magga.prototype.template = function (config, placeholders) {
    var filePath = config.get('configFilePath');
    var stringifyConfig;

    if (configCache[filePath] && configCache[filePath].template) {
        return immutable.fromJS(JSON.parse(configCache[filePath].template(placeholders)));
    }

    stringifyConfig = JSON.stringify(config);
    configCache[filePath].template = _.template(stringifyConfig);
    this.emit('placeholders', placeholders);

    return immutable.fromJS(JSON.parse(configCache[filePath].template(placeholders)));
};
/**
 * CreateFactory requires a config file, parses the jig's names, and returns a function maggaApp,
 * that will require every /yg/jig/jigName when called in Magga.render()
 *
 * @param {String} configPath - path to the config file
 * @returns {function} maggaApp - will require all files when passed into Magga.render(maggaApp, fn)
 *
 */
Magga.prototype.createFactory = function(configPath){

    var maggaApp,
        startPath = 'test/yd',//delete when testing over.
        // startPath = 'yd/',
        config = fs.readFileSync(configPath, {encoding: 'utf-8'}),
        jigs = JSON.parse(config),
        jigsKeys = Object.keys(jigs["jigs"]),//has key of every jig: "Yd.Jig.JigName"
        files2require = [],
        requiredJigs = {};

    // push jig paths into files2require
    jigsKeys.map(function(jig){
        // parse jig name out of config file. /Yd/Jigname -> Jigname
        var jigName = jig.replace('Yd', '').replace(/\./g,'/').toLowerCase();
        files2require.push(path.join(__dirname, startPath, jigName));
    });
    // require every jig included in the configFile['jigs']
    maggaApp = function(){
        var returnObj = {"config": jigs, "keys": jigsKeys},
            i = 0; // current jig
        files2require.map(function(path2file){
            requiredJigs[jigsKeys[i]] = require(path2file);
            i++;
        });
        returnObj["jigs"] = requiredJigs;
        return returnObj;
    };
    return maggaApp;
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
 * @param {function} maggaApp - requires files needed to create instances of jigs
 * @param {function} cb       - callback
 * @returns {any}    nothing to return
 */

Magga.prototype.render = function(maggaApp, cb){
    // load all files
    var configInfo   = maggaApp(),
        config = configInfo["config"], // container for jig's default objects
        keys   = configInfo["keys"], // jigName to call constructor
        jigs   = configInfo["jigs"], // jig constructor
        Jig;

    keys.map(function(jigName){
        // Create multiple instances of jigName
        if (config.jigs[jigName] instanceof Array){
            config.jigs[jigName].map(function(defaults){
                Jig = jigs[jigName];
                new Jig(defaults);

            });
        // Create only one instance of jigName
        } else{
            Jig = jigs[jigName];
            new Jig(config.jigs[jigName].defaults);
        }
    });
    cb()
};
/**
 * creates js bundle with the jigs in configPath using browserify.
 *
 * @param {String} configPath
 * @param {Function} cb - cb(bundleString)
 */
Magga.prototype.createBundle = function(configPath, cb){
    // TODO: magga.getPageConfig
        this.pageConfig = configPath;



    // read jigs from file within configPath
    var startPath = 'test/yd',//delete when testing over.
        // startPath = 'yd/',
        config = fs.readFileSync(configPath, {encoding: 'utf-8'}),
        jigs = JSON.parse(config),
        jigsKeys = Object.keys(jigs["jigs"]),//has key of every jig: "Yd.Jig.JigName"
        jigPath,
        jigsToBeBundled = [];

    // adds jig path to bundle
    jigsKeys.map(function(jig){
        // parse jig name out of config file. /Yd/Jigname -> Jigname
        var jigName = jig.replace(/\.|Yd/g,'/').toLowerCase();
        jigPath = path.join(__dirname, startPath, jigName + '.js');
        jigsToBeBundled.push(jigPath);
    });


    browserify.add(jigsToBeBundled);
    var writer = fs.createWriteStream('bundle.js', {encoding: 'utf-8'});
    browserify.bundle().pipe(writer);
    writer.on('end', cb);
};

/**
 * Returns the pageConfig from which the bundle is created.
 *
 * @returns {String|*}
 * TODO: TO BE COMPLETED AND TESTED
 */
Magga.prototype.getPageConfig = function(){
    return this.pageConfig;
};
module.exports = Magga;

