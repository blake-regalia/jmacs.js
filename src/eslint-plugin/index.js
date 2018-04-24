const path = require('path');
const jmacs = require('jmacs');

const hm_sourcemaps = new Map();

const AS_MSGS_IGNORE_META = new Set([
	'block-spacing',
	'function-paren-newline',
	'func-style',
	'no-multi-spaces',
	'no-tabs',
	'indent',
	'semi-spacing',
]);

module.exports = {
	processors: {
		'.jmacs': {
			preprocess(s_text, p_file) {
				let g_result = jmacs.compile({
					input: s_text,
					cwd: path.dirname(p_file),
				});

				hm_sourcemaps.set(p_file, g_result);

				let g_output;
				try {
					g_output = g_result.run();
				}
				catch(e_run) {
					return [g_result.meta.lint];
				}

				g_result.output = g_output;
				return [g_result.meta.lint, g_output.code];
			},

			postprocess(a_output_messages, p_file) {
				let g_result = hm_sourcemaps.get(p_file);
				let a_msgs = [];

				let yc_meta = g_result.meta.consumer();

				// each meta lint message
				for(let g_msg of a_output_messages[0]) {
					let {
						line: i_line,
						column: i_col,
						name: s_name,
					} = yc_meta.originalPositionFor(g_msg);

					// inside user area
					if(null !== i_line) {
						// always ignore whitespace issues
						if(AS_MSGS_IGNORE_META.has(g_msg.ruleId)) {
							continue;
						}

						let b_endline = 'endLine' in g_msg;
						let b_endcol = 'endColumn' in g_msg;
// debugger;
						// same line
						if(b_endline && g_msg.line === g_msg.endLine) {
							Object.assign(g_msg, {
								endLine: i_line,
								endColumn: i_col + (g_msg.endColumn - g_msg.column),
							});
						}

						// line
						if('line' === s_name) {
							Object.assign(g_msg, {
								line: i_line,
								column: i_col + g_msg.column,
								...(b_endcol? {endColumn:g_msg.endColumn + g_msg.column}: {}),
								// ...(n_chars
								// 	? {
								// 		endLine: i_line,
								// 		endColumn: i_col+g_msg.column+n_chars,
								// 	}
								// 	: {
								// 		...(b_endline? {endLine:i_line}: {}),
								// 		...(b_endcol? {endColumn:g_msg.endColumn+i_col}: {}),
								// 	}),
							});
						}
						else {
// debugger;
							// apply mapping inverse
							Object.assign(g_msg, {
								line: i_line,
								column: i_col + 1,
								...(b_endcol? {endColumn:g_msg.endColumn + 1}: {}),
							});
						}

						//
						a_msgs.push(g_msg);
					}
				}

				// meta compiled
				if(a_output_messages.length > 1) {
					let yc_output = g_result.output.consumer();

					// each output lint message
					for(let g_msg of a_output_messages[1]) {
						let {
							line: i_row,
							column: i_col,
						} = yc_output.originalPositionFor(g_msg);

						// inside user area
						if(null !== i_row) {
							// always ignore whitespace issues
							if(AS_MSGS_IGNORE_META.has(g_msg.ruleId)) {
								continue;
							}
debugger;
							let b_endline = 'endLine' in g_msg;
							let b_endcol = 'endColumn' in g_msg;

							let b_same_line = b_endline && (g_msg.line === g_msg.endLine);
							let i_msg_column = g_msg.column;

							i_col += g_msg.column;

							// apply mapping inverse
							Object.assign(g_msg, {
								line: i_row,
								column: i_col,
							});

							// same line
							if(b_same_line) {
								Object.assign(g_msg, {
									endLine: i_row,
									endColumn: i_col + (g_msg.endColumn - i_msg_column),
								});
							}

							a_msgs.push(g_msg);
						}
					}
				}

				return a_msgs;
			},
		},
	},
	configs: {
		all: {
			plugins: [
				'jmacs',
			],
		},
	},
};
