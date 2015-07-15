
filename = process.argv[2];

var fs = require('fs');
var parse = require('csv-parse');

var parser = parse(function(err, output) {
   	console.log(JSON.stringify(output));
});

fs.createReadStream(filename).pipe(parser);