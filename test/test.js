'use strict';
require('..')({
    tar: 'node.tar',
    url: 'https://codeload.github.com/joyent/node/tar.gz/v0.11.13',
    checksum: 'a8df6d0f35a9247ca98820e90a966089621bffc7',
    silent: false,
}).then(function () {
    console.log('Done!');
}, function (err) {
    console.log('Failure');
    console.log(err);
    process.exit(1);
});
