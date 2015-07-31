var Magga = require("../../"),
    through = require('through'),
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
 * TODO use that also for node.js with VM module
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
        code += 'require("' + Magga.jigToPath(keys[i]) + '");\n';
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