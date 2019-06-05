#!/usr/bin/env node
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Node objects

var defaultSettings = require('./lib/svg-optimize-default.json');

var path = require('path');
var SVGO = require('svgo');
var fs = require('fs');

var SVGOptimizer = function () {
    function SVGOptimizer() {
        var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'input';
        var output = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'output';

        _classCallCheck(this, SVGOptimizer);

        var cmdArgs = this.getCmdArguments();
        this.config = {
            inputFolder: cmdArgs.input || input,
            outputFolder: cmdArgs.output || output,
            settingsFile: cmdArgs.settings || defaultSettings
        };
        this.SVGOSettings = (typeof defaultSettings === 'undefined' ? 'undefined' : _typeof(defaultSettings)) === 'object' ? defaultSettings : JSON.parse(fs.readFileSync(this.config.settingsFile, 'utf8'));
        this.SVGo = new SVGO(this.parseSVGOSettings(this.SVGOSettings));
        this.watchFolder(this.checkIsWatch());
    }

    _createClass(SVGOptimizer, [{
        key: 'getCmdArguments',
        value: function getCmdArguments() {
            return {
                input: this.getCmdArgumentValue('input'),
                output: this.getCmdArgumentValue('output'),
                settings: this.getCmdArgumentValue('settings')
            };
        }
    }, {
        key: 'getCmdArgumentValue',
        value: function getCmdArgumentValue(target) {
            var flagPos = this.findArgument('--' + target);
            return flagPos !== false ? process.argv[flagPos + 1] : null;
        }
    }, {
        key: 'findArgument',
        value: function findArgument(target) {
            var argPos = process.argv.indexOf(target);

            return argPos !== -1 ? argPos : false;
        }
    }, {
        key: 'parseSVGOSettings',
        value: function parseSVGOSettings(settings) {
            var parsed = {
                plugins: []
            };
            for (var p in settings) {
                if (!settings.hasOwnProperty(p)) continue;

                var obj = {};
                obj[p] = settings[p];
                parsed.plugins.push(obj);
            }
            return parsed;
        }
    }, {
        key: 'checkIsWatch',
        value: function checkIsWatch() {
            return this.findArgument('--watch') ? true : false;
        }
    }, {
        key: 'optimizeIfNeeded',
        value: function optimizeIfNeeded(file) {
            if (!this.fileIsSVG(file)) return;

            this.optimizeFile(file);
        }
    }, {
        key: 'fileIsSVG',
        value: function fileIsSVG(filename) {
            var extension = path.extname(filename);
            return extension.toLowerCase() === '.svg' ? true : false;
        }
    }, {
        key: 'optimizeFile',
        value: function optimizeFile(file) {
            var processor = this.SVGo;
            var outputFile = file.replace(this.config.inputFolder, this.config.outputFolder);
            var targetDir = path.dirname(outputFile);

            fs.readFile(file, 'utf8', function (err, data) {
                if (err) throw err;
                processor.optimize(data, { path: file }).then(function (result) {
                    var output = result.data;

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true }, function (err) {
                            if (err) throw err;
                        });
                    }

                    fs.writeFileSync(outputFile, output, 'utf8', function (err) {
                        if (err) return console.log(err);

                        console.log('File ' + outputFile + ' was saved');
                    });
                });
            });
        }
    }, {
        key: 'watchFolder',
        value: function watchFolder(isWatch) {
            var chokidar = require('chokidar');
            var options = {
                ignored: /^\./,
                persistent: isWatch,
                interval: 2000,
                cwd: '.',
                depth: 99,
                awaitWriteFinish: {
                    stabilityThreshold: 3000,
                    pollInterval: 1000
                }
            };
            var that = this;

            var watcher = chokidar.watch(this.config.inputFolder, options);

            watcher.on('add', function (path) {
                that.optimizeIfNeeded(path);
            }).on('change', function (path) {
                that.optimizeIfNeeded(path);
            }).on('unlink', function (path) {
                console.log('File', path, 'has been removed');
            }).on('error', function (error) {
                console.error('Error happened', error);
            });
        }
    }]);

    return SVGOptimizer;
}();

var optimizer = new SVGOptimizer();