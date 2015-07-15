'use strict';

var rewire = require('rewire');
var path = require('path');
var sinonPromise = require('sinon-promise');

var _ = require('lodash');

var Magga = rewire('../index');

var _readFile = Magga.__get__('readFile');
sinonPromise(sinon);

describe('Magga', function () {
    describe('readFileIfExists', function () {
        var fs,
            readFile,
            readFileIfExists;

        beforeEach(function () {
            fs = {
                readFile: sinon.stub()
            };
            readFile = sinon.promise();
            Magga.__set__('fs', fs);
            Magga.__set__('readFile', readFile);
            Magga.__set__('files', Object.create(null));

            readFileIfExists = Magga.__get__('readFileIfExists');
        });


        it('should read a file if it doesnt exist in cache', function (done) {
            var config = {foo: 1};
            readFile.resolves(JSON.stringify(config));
            readFileIfExists('/foo/bar')
                .then(function (result) {
                    expect(result).to.eql(config);
                    expect(readFile.called).to.eql(true);
                    expect(readFile.getCall(0).args[0]).to.eql('/foo/bar');
                    done();
                });
        });

        it('should read the file twice', function (done) {
            var config = {foo: 1};
            readFile.resolves(JSON.stringify(config));
            readFileIfExists('/foo/bar')
                .then(function () {
                    return readFileIfExists('/foo/bar');
                })
                .then(function (result) {
                    expect(result).to.eql(config);
                    expect(readFile.calledOnce).to.eql(true);
                    done();
                });
        });

        it('should return empty object if there is no such file', function (done) {
            readFile.rejects({code: 'ENOENT'});

            readFileIfExists('/foo/bar')
                .then(function (result) {
                    expect(result).to.eql({});
                    expect(readFile.calledOnce).to.eql(true);
                    done();
                });
        });

        it('should return error if JSON is not valid', function (done) {
            readFile.resolves('not a JSON at all');

            readFileIfExists('/foo/bar')
                .catch(function (err) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.message).to.have.string('/foo/bar');
                    expect(readFile.calledOnce).to.eql(true);
                    done();
                });
        });
    });

    describe('getFoldersConfigPaths', function () {
        var getFoldersConfigPaths;

        before(function () {
            Magga.__set__('readFile', _readFile);
        });
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

    describe('#getConfig', function () {
        var magga;
        var fs = require('fs');
        beforeEach(function () {
            Magga.__set__('fs', fs);
            Magga.__set__('files', {});
            Magga.__set__('configCache', {});
        });

        it('should get config from one file', function (done) {
            var pagePath = path.join(__dirname,
                'fixtures/simple_example/page/page.conf');

            magga = new Magga({
                basePath: path.join(__dirname, 'fixtures/simple_example')
            });

            magga.getConfig('page/page.html', function (err, res) {
                var fileContent = fs.readFileSync(pagePath, {encoding: 'utf-8'});
                var result = JSON.parse(fileContent);

                expect(err).to.eql(null);

                expect(res.get('configFilePath')
                    .replace('.html', '.conf')).to.eql(pagePath);
                expect(res.delete('configFilePath').toJS()).to.eql(result);
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
                expect(res.delete('configFilePath').toJS()).to.eql(
                    _.merge(JSON.parse(pageContent), JSON.parse(indexContent)));
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
                expect(res.delete('configFilePath').toJS()).to.eql(JSON.parse(indexContent));
                done();
            });
        });

        it('should replace placeholders', function (done) {

            magga = new Magga({
                basePath: path.join(__dirname, 'fixtures/with_placeholders')
            });

            magga.getConfig('page/page.html', function (err, res) {
                var result = magga.template(res, {restaurantId: 42});
                expect(err).to.eql(null);
                expect(result.get('foo').get('apicall')).to.eql('/restaurants/42');
                done();
            });
        });
    });

    describe('#createFactory', function(){
        var magga = new Magga({
            basePath: path.join(__dirname, 'fixtures/simple_example')
        });

        it('should create a instance for every jig in config file', function(){

            var configPath = path.join(__dirname, 'fixtures/create_factory/page/jigs.conf');
            var maggaApp = magga.createFactory(configPath);
            magga.render(maggaApp, function(){});
        });
        it('should be able to use magga as singleton', function(){

            var instance1 = Magga.getInstance({x:1});
            var instance2 = Magga.getInstance();
            expect(instance1).to.eql(instance2);
        });
        it('should extend _config and update instance without creating a new one', function(){

            var instance1 = Magga.getInstance({x:1});
            var instance2 = Magga.getInstance({y:2});
            expect(instance1).to.eql(instance2);
            var instance3 = Magga.getInstance();
            expect(instance2).to.eql(instance3);
        });
    });
});