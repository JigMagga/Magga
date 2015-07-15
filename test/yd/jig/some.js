/**
 * Created by developer on 30.06.15.
 */
var immutable = require('immutable');
function Some(defaults){
    this.defaults = defaults;
    this.test = immutable.fromJS({x:1});
    console.log("Instance of jig/Some created with defaults: ", defaults);
}
module.exports = Some;
