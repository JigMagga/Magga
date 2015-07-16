var gulp = require('gulp'),
    connect = require('gulp-connect'),
    Browserify = require("browserify"),
    Magga = require("../../src/browserify");

gulp.task('webserver', function () {
    connect.server({
        middleware: function (connect, opt) {
            return [
                function (req, res, next) {
                    if (req.url && req.url.indexOf(".js") !== -1) {
                        var magga = Magga.getInstance(),
                            browserify = Browserify({debug: true});

                        magga.browserifyPlugin(browserify);
                        browserify
                            .transform(magga.browserifyConfTransform())
                            .add(__dirname + req.url)
                            .bundle().pipe(res);

                    } else {
                        next();
                    }

                }
            ]
        }
    });
});

gulp.task('default', ['webserver']);