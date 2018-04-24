
const parser = require('./parser');

module.exports = function(h_config) {
	// destructure config
	let {
		input: s_input,
		path: p_file,
		cwd: p_cwd,
	} = h_config;

	// parse input
	let g_result;
	try {
		g_result = parser.parse(s_input)(p_cwd, p_file);
	}
	catch(e_parse) {
		throw e_parse;
	}

	//
	return g_result;
};
