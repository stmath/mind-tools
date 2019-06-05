#!/usr/bin/env node
// Node objects

let defaultSettings = require('./lib/svg-optimize-default.json');

let path = require('path');
let SVGO = require('svgo');
let fs = require('fs');

class SVGOptimizer {
    constructor (input = 'input', output = 'output') {
        let cmdArgs = this.getCmdArguments();
        this.config = {
            inputFolder: cmdArgs.input || input,
            outputFolder: cmdArgs.output || output,
            settingsFile: cmdArgs.settings || defaultSettings
        };
        this.SVGOSettings = typeof defaultSettings === 'object'
            ? defaultSettings
            : JSON.parse(fs.readFileSync(this.config.settingsFile, 'utf8'));
        this.SVGo = new SVGO(this.parseSVGOSettings(this.SVGOSettings));
        this.watchFolder(this.checkIsWatch());
    }

    getCmdArguments () {
        return {
            input: this.getCmdArgumentValue('input'),
            output: this.getCmdArgumentValue('output'),
            settings: this.getCmdArgumentValue('settings')
        };
    }

    getCmdArgumentValue (target) {
        let flagPos = this.findArgument('--' + target);
        return flagPos !== false
            ? process.argv[flagPos + 1]
            : null;
    }

    findArgument (target) {
        let argPos = process.argv.indexOf(target);

        return argPos !== -1
            ? argPos
            : false;
    }

    parseSVGOSettings (settings) {
        let parsed = {
            plugins: []
        };
        for (let p in settings) {
            if (!settings.hasOwnProperty(p))
                continue;

            let obj = {};
            obj[p] = settings[p];
            parsed.plugins.push(obj);
        }
        return parsed;
    }

    checkIsWatch () {
        return (this.findArgument('--watch'))
            ? true
            : false;
    }

    optimizeIfNeeded (file) {
        if (!this.fileIsSVG(file))
            return;

        this.optimizeFile(file);
    }

    fileIsSVG (filename) {
        let extension = path.extname(filename);
        return (extension.toLowerCase() === '.svg')
            ? true
            : false;
    }

    optimizeFile (file) {
        let processor = this.SVGo;
        let outputFile = file.replace(this.config.inputFolder, this.config.outputFolder);
        let targetDir = path.dirname(outputFile);

        fs.readFile(file, 'utf8', function (err, data) {
            if (err) throw err;
            processor.optimize(data, { path: file })
                .then(function (result) {
                    let output = result.data;

                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true }, (err) => {
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

    watchFolder (isWatch) {
        let chokidar = require('chokidar');
        let options = {
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
        let that = this;

        let watcher = chokidar.watch(this.config.inputFolder, options);

        watcher
            .on('add', function (path) {
                that.optimizeIfNeeded(path);
            })
            .on('change', function (path) {
                that.optimizeIfNeeded(path);
            })
            .on('unlink', function (path) {
                console.log('File', path, 'has been removed');
            })
            .on('error', function (error) {
                console.error('Error happened', error);
            });
    }
}

const optimizer = new SVGOptimizer();
