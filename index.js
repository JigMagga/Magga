'use strict';

var immutable = require('immutable'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    path = require('path'),
    fs = require('fs'),
    Promise = require('bluebird'),
    _ = require('lodash');


var files = {};


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

/**
 * returns array with pathes to config file
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


var readFileIfExists = function (filePath, placeholders) {
    return new Promise(function (reslove, reject) {
        fs.readFile(filePath, {encoding: 'utf-8'}, function (err, res) {
            if (err) {
                if (err.code === 'ENOENT') {
                    return reslove({});
                }
                return reject(err);
            }
            res = (placeholders) ? _.template(res)(placeholders) : res;

            try {
                res = JSON.parse(res);
            } catch (e) {
                reject(new Error('config ' + filePath + ' is not a JSON'));
            }
            reslove(res);
        });
    });
};

/**
 * read file and put the Prmise to cache
 *
 * @param {string} filePath - path to file
 * @param {Object} placeholders - object that should be used in template function.
 * @returns {Promise} promise with file content
 */
var readFile = function (filePath, placeholders) {
    if (files[filePath]) {
        return files[filePath];
    }

    files[filePath] = readFileIfExists(filePath, placeholders);

    return files[filePath];
};


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
    config.basePath = config.basePath || __dirname;
    config.getFilePath = config.getFilePath || getFilePath;
    config.getFilePath = config.getFilePath.bind(null, config);

    this.config = immutable.fromJS(config || {});
}

util.inherits(Magga, EventEmitter);


/**
 * create config for some file and parse configs for it
 *
 * @param {string} pagePath - path to the page
 * @param {Object} placeholders - object with placeholders
 * @param {Function} callback - the result callback
 *
 * @returns {Object} return config
 */
Magga.prototype.getConfig = function getConfig(pagePath, placeholders, callback) {
    var filePath = this.config.get('getFilePath')(pagePath);
    var configPathes = getFoldersConfigPaths(this.config.get('basePath'), filePath);

    if (_.isFunction(placeholders)) {
        callback = placeholders;
        placeholders = null;
    }

    if (placeholders) {
        this.emit('placeholders', placeholders);
    }

    Promise.all(configPathes.map(function (configPath) {
        return readFile(configPath, placeholders);
    })).then(function (results) {
        var result = results.reduce(function (accumulator, currentConfig) {
            this.emit('extend', accumulator, currentConfig);
            return _.merge(accumulator, currentConfig);
        }.bind(this), {});

        this.emit('done', result);
        callback(null, immutable.fromJS(result));
    }.bind(this));
};


module.exports = Magga;
