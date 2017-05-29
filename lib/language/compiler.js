
const parser = require('./parser');

module.exports = function(h_config) {
	// destructure config
	let {
		input: s_input,
		cwd: p_cwd,
	} = h_config;

	// parse input
	let h_result;
	try {
		h_result = parser.parse(s_input)(p_cwd);
	}
	catch(e_parse) {
		return {
			error: e_parse,
		};
	}
	//
	return h_result;
};
