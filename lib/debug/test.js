const jmacs = require('../main/jmacs');

let h_result = jmacs.load(process.argv[2] || __dirname+'/../../scrap/n-deserializer.js');

if(h_result.error) {
	console.error(h_result.error.message);
	throw '';
}

// console.dir(h_result);
console.info(h_result.output);
