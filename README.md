tar-grab-unpack
===============

Node.js utlity to grab tar files and unpack them.

```javascript
'use strict';
var tarGrabUnpack = require('tar-grab-unpack');

tarGrabUnpack({
    tar: 'node.tar',
    path: 'node',
    maxRetries: 3,
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
```


This will download Node.js 11.13 and save it to `./node.tar`. When it has downloaded,
it checksums the contents to ensure it matches the given checksum, and unpacks
the contents to `./node/`.

Actually, that's a lie - while it is downloading it streams the download into
both checksum and tar - meaning that it unpacks and checksums it while downloading.
If the checksum fails it removes the tar and the folder and tries again.

Set `silent: true` to disable the progress bar. Run with
`process.env.DEBUG=tar-grabber` to get lots of debug info.
