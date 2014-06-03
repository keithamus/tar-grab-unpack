'use strict';
var Promise = require('es6-promise').Promise,
    debug = require('debug')('tar-grabber'),
    ProgressBar = require('progress'),
    stream = require('stream'),
    http = require('http'),
    https = require('https'),
    util = require('util'),
    fs = require('fs'),
    crypto = require('crypto'),
    tar = require('tar'),
    _rimraf = require('rimraf'),
    path = require('path'),
    zlib = require('zlib'),
    tarGrabber;

function rimraf(file) {
    return new Promise(function (resolve, reject) {
        _rimraf(file, function (err, data){
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    });
}

function ProgressStream(options) {
    this.progress = new ProgressBar(options.text || '[:bar]', {
        complete: options.complete || '=',
        incomplete: options.incomplete || ' ',
        width:  options.width || 20,
        total:  options.total,
    });
    stream.PassThrough.call(this);
}
util.inherits(ProgressStream, stream.PassThrough);
ProgressStream.prototype._transform = function (chunk, encoding, callback) {
    this.progress.tick(chunk.length);
    return stream.PassThrough.prototype._transform.call(this, chunk, encoding, callback);
};

function ensureFile(file, url, silent) {
    return new Promise(function (resolve) {
        fs.exists(file, resolve);
    }).then(function (exists) {
        if (exists) {
            debug('File exists at ' + path.relative(process.cwd(), file));
            return new fs.ReadStream(file);
        }
        return new Promise(function (resolve, reject) {
            debug('File does not exist, downloading');
            debug('Requesting ' + url);
            var protocolHandler = /https:/.test(url) ? https : http;
            protocolHandler.get(url, resolve).on('error', reject);
        }).then(function (response) {
            debug('Got response, headers:');
            var writeStream = new fs.WriteStream(file),
                headers = response.headers;
            Object.keys(headers).forEach(function (header) {
                debug('    ' + header + ': ' + headers[header]);
            });
            console.log('Downloading ' + url);
            if (!silent) {
                response = response.pipe(new ProgressStream({
                    text: '[:bar] :percent :etas :current/:total',
                    total: Number(response.headers['content-length'])
                }));
            }
            if (headers['content-encoding'] === 'gzip' || /gzip$/.test(headers['content-type'])) {
                response = response.pipe(zlib.Unzip());
            }
            response.pipe(writeStream);
            return response;
        });

    });
}

tarGrabber = module.exports = function (options) {
    options.silent = options.silent || false;
    options.retryCount = options.retryCount || 3;
    options.attemptNumber = options.attemptNumber || 0;
    options.path = path.resolve(options.path || options.tar.substring(0, options.tar.length - 4));
    options.tar = path.resolve(options.tar);
    debug('Desired extract path ' + options.path);
    debug('File to extract ' + options.path);
    debug('Desired checksum ' + options.checksum);
    debug('File backup location ' + options.url);
    debug('Checking... Attempt number ' + (options.attemptNumber + 1));
    return ensureFile(options.tar, options.url)
        .then(function (fileReadStream) {
            return new Promise(function (resolve, reject) {
                debug('Analysing checksum of file contents and extracting');
                var passThrough1 = new stream.PassThrough(),
                    tarStream = tar.Extract({ path: options.path, strip: 1 }),
                    hashStream = new crypto.Hash('sha1');
                passThrough1.pipe(tarStream);
                fileReadStream
                    .pipe(passThrough1)
                    .on('end', function () {
                        debug('Hashing file completed');
                        resolve(hashStream.digest('hex'));
                    })
                    .on('error', reject)
                    .pipe(hashStream, { end: false });
                tarStream.on('entry', function (entry) {
                    debug('unpack ./' + path.relative(process.cwd(), path.resolve(options.path, entry.path)));
                }).on('error', reject);
            });
        }).then(function (checksum) {
            if (!checksum) {
                throw new Error('No checksum!');
            }
            checksum = checksum.toString('hex');
            debug('Calculated checksum is ' + checksum);
            if (checksum !== options.checksum) {
                var error = new Error('Checksum differs from proposed checksum');
                error.code = 'EDIFFCHECKSUM';
                throw error;
            }
            return options.path;
        }).catch(function (error) {
            debug(error.stack || 'Error: ' + (error.message || error.code || error));
            options.attemptNumber += 1;
            debug('Removing ' + options.path);
            debug('Removing ' + options.tar);
            debug();
            debug();
            return rimraf(options.path)
                .then(rimraf(options.tar))
                .then(function () {
                    if (options.attemptNumber >= options.retryCount) {
                        debug('Maximum tried reached');
                        error = new Error('Maximum download attempts reached');
                        error.code = 'EMAXTRIES';
                        throw error;
                    }
                })
                .then(tarGrabber(options));
        });
};
