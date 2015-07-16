var Magga = require("../../../../").getInstance();

module.exports = function Some(){
    console.log("Some test constructor that simulates a Jig", arguments, Magga.getPageConfig());
};