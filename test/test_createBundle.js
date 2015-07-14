'use strict';


var Magga = require('./../index.js'),
    path  = require('path'),
    bundle,
    magga = new Magga({
    basePath: path.join(__dirname, 'fixtures/create_factory')
});

var configPath = path.join(__dirname, 'fixtures/create_factory/page/jigs.conf');
console.log("Create bundle with ", configPath);
magga.createBundle(configPath, function(){
    bundle = require('bundle.js');
    console.log("Now bundle.js contains the files specified in the configPage");
});

