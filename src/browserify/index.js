var Magga = require("../../"),
    through = require('through'),
    fs = require("fs"),
    path = require("path"),
    pathmodify = require('pathmodify');

/**
 *
 * @param browserifyInstance
 * @returns {Function}
 */
Magga.prototype.browserifyConfTransform = function () {
    var self = this,
        data,
        extension = self.config().get("extension");
    return function (file) {
        data = '';
        if (file && file.indexOf(extension) !== -1) {
            function write(buf) {
                data += buf
            }

            function end() {
                //this.queue('module.exports = ' + data);
                this.queue(self.transformConfIntoJS(JSON.parse(data)));
                this.queue(null);
            }

            return through(write, end);
        } else {
            return through();
        }
    };
};


/**
 *
 * @param conf
 * @param browserifyInstance
 * @returns {string}
 */
Magga.prototype.transformConfIntoJS = function (conf) {
    var i,
        len,
        keys = Object.keys(conf.jigs),
        code = '';
    for (i = 0, len = keys.length; i < len; i++) {
        // replace Jig.Some to path jig/some/some.js
        code += 'require("' + keys[i].replace(".", "/").replace(/\/(.*)$/, "/$1/$1.js").toLowerCase() + '");\n';
    }
    return code + "module.exports =" + JSON.stringify(conf);
};


/**
 * creates js bundle with the jigs in configPath using browserify.
 *
 * @param {String} configPath
 * @param {Function} cb - cb(bundleString)
 */
Magga.prototype.createBundle = function (configPath, cb) {
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
    jigsKeys.map(function (jig) {
        // parse jig name out of config file. /Yd/Jigname -> Jigname
        var jigName = jig.replace(/\.|Yd/g, '/').toLowerCase();
        jigPath = path.join(__dirname, startPath, jigName + '.js');
        jigsToBeBundled.push(jigPath);
    });


    browserify.add(jigsToBeBundled);
    var writer = fs.createWriteStream('bundle.js', {encoding: 'utf-8'});
    browserify.bundle().pipe(writer);
    writer.on('end', cb);
};


/**
 *
 * @param conf
 * @param browserifyInstance
 * @returns {string}
 */
Magga.prototype.browserifyPlugin = function (browserify) {
    var self = this,
        extension = self.config().get("extension");
    browserify.plugin(pathmodify(), {
        mods: [function (rec) {
            // only expose files that are
            if (rec.opts.filename.indexOf(extension) !== -1) {
                return {
                    id: rec.id,
                    // expose the relative path the the current cwd directory
                    expose:  rec.id
                }
            } else {
                return {
                    id: rec.id
                }
            }
        }]
    });
};


module.exports = Magga;