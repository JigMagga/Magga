'use strict';

var rewire = require('rewire');
var path = require('path');
var _ = require('lodash');

var Magga = rewire('../index');


describe('Magga', function () {
    describe('readFileIfExists', function () {
        var fs,
            readFileIfExists;

        beforeEach(function () {
            fs = {
                readFile: sinon.stub()
            };
            Magga.__set__('fs', fs);
            readFileIfExists = Magga.__get__('readFileIfExists');
        });


        it('should read a file if it doesnt exist in cache', function (done) {
            var config = {foo: 1};
            fs.readFile.callsArgWith(2, null, JSON.stringify(config));
            readFileIfExists('/foo/bar')
                .then(function (result) {
                    expect(result).to.eql(config);
                    expect(fs.readFile.called).to.eql(true);
                    expect(fs.readFile.getCall(0).args[0]).to.eql('/foo/bar');
                    done();
                });
        });

        it('should read the file twice', function (done) {
            var config = {foo: 1};
            fs.readFile.callsArgWith(2, null, JSON.stringify(config));
            readFileIfExists('/foo/bar')
                .then(function () {
                    return readFileIfExists('/foo/bar');
                })
                .then(function (result) {
                    expect(result).to.eql(config);
                    expect(fs.readFile.calledTwice).to.eql(true);
                    done();
                });
        });

        it('should return empty object if there is no such file', function (done) {
            fs.readFile.callsArgWith(2, {code: 'ENOENT'});

            readFileIfExists('/foo/bar')
                .then(function (result) {
                    expect(result).to.eql({});
                    expect(fs.readFile.calledOnce).to.eql(true);
                    done();
                });
        });

        it('should return error if JSON is not valid', function (done) {
            fs.readFile.callsArgWith(2, null, 'not a JSON at all');

            readFileIfExists('/foo/bar')
                .catch(function (err) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.have.string('/foo/bar');
                    expect(fs.readFile.calledOnce).to.eql(true);
                    done();
                });
        });

        it('should substitute the placehoders by value if placeholder object exists',
            function (done) {
            var config = {foo: "<%= bar %>"};
            fs.readFile.callsArgWith(2, null, JSON.stringify(config));
            readFileIfExists('/foo/bar', {bar: 1})
                .then(function (result) {
                    expect(result).to.eql({foo: '1'});
                    done();
                });
        });
    });

    describe('getFoldersConfigPaths', function () {
        var getFoldersConfigPaths;

        beforeEach(function () {
            getFoldersConfigPaths = Magga.__get__('getFoldersConfigPaths');
        });

        it('should return list of paths to config files that should be merged', function () {
            var basePath = '/usr/foo/bar',
                pathToConfig = './page/index/index.conf';

            var result = getFoldersConfigPaths(basePath, path.join(basePath, pathToConfig));

            expect(result).to.have.length(2);
            expect(result[0]).to.eql(path.join(basePath, '/page/index/index.conf'));
        });

        it('should not throw stack exception if the path it to long', function () {
            var basePath = '/usr/foo/bar',
                pathToConfig = _.range(1000).join('/') + '/42.conf';

            var result = getFoldersConfigPaths(basePath, path.join(basePath, pathToConfig));

            expect(result).to.be.an('array');
            expect(result).to.have.length(1000);
            expect(_.last(result)).to.eql(path.join(basePath, '/0/0.conf'));
        });
    });

    describe('Magga', function () {
       describe('#getConfig', function () {
           var magga;
           var fs = require('fs');
           beforeEach(function () {
               Magga.__set__('fs', fs);
           });

           it('should get config from one file', function (done) {

               magga = new Magga({
                   basePath: path.join(__dirname, 'fixtures/simple_example')
               });

               magga.getConfig('page/page.html', function (err, res) {
                   var fileContent = fs.readFileSync(path.join(__dirname,
                       'fixtures/simple_example/page/page.conf'), {encoding: 'utf-8'});

                   expect(err).to.eql(null);
                   expect(res.toJS()).to.eql(JSON.parse(fileContent));
                   done();
               });
           });

           it('should get config from two files', function (done) {
               magga = new Magga({
                   basePath: path.join(__dirname, 'fixtures/two_configs')
               });

               magga.getConfig('page/index/index.html', function (err, res) {
                   var pageContent = fs.readFileSync(path.join(__dirname,
                       'fixtures/two_configs/page/page.conf'), {encoding: 'utf-8'});
                   var indexContent = fs.readFileSync(path.join(__dirname,
                       'fixtures/two_configs/page/index/index.conf'), {encoding: 'utf-8'});

                   expect(err).to.eql(null);
                   expect(res.toJS()).to.eql(
                       _.merge(JSON.parse(indexContent), JSON.parse(pageContent)));
                   done();
               });
           });
           it('should get config when some files are missing', function (done) {
               magga = new Magga({
                   basePath: path.join(__dirname, 'fixtures/without_page_config')
               });

               magga.getConfig('page/index/index.html', function (err, res) {
                   var indexContent = fs.readFileSync(path.join(__dirname,
                       'fixtures/without_page_config/page/index/index.conf'), {encoding: 'utf-8'});

                   expect(err).to.eql(null);
                   expect(res.toJS()).to.eql(JSON.parse(indexContent));
                   done();
               });
           });
       });
    });
});