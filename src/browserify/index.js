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
        data;
    return function (file) {
        data = '';
        // TODO ".conf" should be configurable via Magga.config();
        if (file && file.indexOf(".conf") !== -1) {
            function write(buf) {
                data += buf
            }

            function end() {
                //this.queue('module.exports = ' + data);
                this.queue(self.createBundle(JSON.parse(data)));
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
Magga.prototype.createBundle = function (conf) {
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
 *
 * @param conf
 * @param browserifyInstance
 * @returns {string}
 */
Magga.prototype.browserifyPlugin = function (browserify) {
    browserify.plugin(pathmodify(), {
        mods: [function (rec) {
            return {
                id: rec.id,
                expose: rec.id
            }
        }]
    });
};


module.exports = Magga;