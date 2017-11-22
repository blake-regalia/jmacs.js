const fs = require('fs');
const path = require('path');
const util = require('util');

const H_BUILTIN_CONSTANTS = {};
const H_BUILTIN_FUNCTIONS = {};
for(let s_prop of Object.getOwnPropertyNames(Math)) {
	let z_value = Math[s_prop];

	if('function' === typeof z_value) {
		H_BUILTIN_FUNCTIONS[s_prop] = z_value;
	}
	else if('number' === typeof z_value) {
		H_BUILTIN_CONSTANTS[s_prop] = z_value;
	}
}


const h_program = {
	if(h_if, h_context) {
		let s_output = '';
		if(this.evaluate(h_if.if, h_context)) {
			s_output = this.evaluate_body(h_if.then, h_context);
		}
		else {
			let b_elseifs = h_if.elseifs.some((h) => {
				if(this.evaluate(h.if, h_context)) {
					s_output = this.evaluate_body(h.then, h_context);
					return true;
				}
			});

			if(!b_elseifs && h_if.else) {
				s_output = this.evaluate_body(h_if.else, h_context);
			}
		}
		return s_output;
	},

	assignment(h_assign, h_context) {
		let s_variable = h_assign.name;
		let h_scope = h_context.hasOwnProperty(s_variable)? h_context: this.global;
		h_scope[s_variable] = this.evaluate(h_assign.expression, h_context);
		return '';
	},

	macro(h_macro) {
		this.macros[h_macro.name] = h_macro;
		return '';
	},

	verbatim(h_verbatim) {
		return h_verbatim.value;
	},

	inline(h_inline, h_context) {
		return this.evaluate(h_inline.expression, h_context);
	},

	include(h_include, h_context) {
		let s_file = this.evaluate(h_include.file, h_context);

		let p_file = path.resolve(this.cwd, s_file);
		let s_input = fs.readFileSync(p_file, 'utf8');
		let h_result = require('./compiler')({
			input: s_input,
			cwd: path.dirname(p_file),
		});

		if(h_result.error) {
			throw h_result.error;
		}

		// merge macros and globals
		let h_include_macros = h_result.macros;
		for(let s_macro in h_include_macros) {
			this.macros[s_macro] = h_include_macros[s_macro];
		}

		let h_include_global = h_result.global;
		for(let s_global in h_include_global) {
			this.global[s_global] = h_include_global[s_global];
		}

		// append output
		return h_result.output;
	},

	repeat(h_repeat, h_context) {
		let n_times = +this.evaluate(h_repeat.times, h_context);
		let h_local = Object.create(h_context);
		let s_output = '';
		for(let i=n_times-1; i>=0; i--) {
			h_local.loop_index = i;
			s_output += this.evaluate_body(h_repeat.body, h_local);
		}
		return s_output;
	},
}

module.exports = (a_sections) => {
	return function(p_cwd) {
		let h_states = {
			cwd: p_cwd,
			macros: {},
			global: H_BUILTIN_CONSTANTS,
			output: '',
			
			evaluate_body(a_body, h_context) {
				let s_output =  '';
				a_body.forEach((h) => {
					s_output += h_program[h.type].apply(this, [h, h_context]);
				});
				return s_output;
			},

			evaluate(h_expr, h_context) {
				if(!h_expr) return null;
				switch(h_expr.type) {
					case 'call': {
						let a_args = h_expr.args.map(h => this.evaluate(h, h_context));
						return this.call_macro(h_expr.macro, a_args);
					}
					case 'variable': {
						let s_name = h_expr.name;
						if(s_name in h_context) {
							return h_context[s_name];
						}
						else {
							console.warn(`variable '${s_name}' is undefined`);
							return null;
							// debugger;
							// throw 'undefined variable';
						}
					}
					case 'boolean':
					case 'number':
					case 'string': return h_expr.value;
					case 'binary_expression': {
						let z_lhs = this.evaluate(h_expr.left, h_context);
						let z_rhs = this.evaluate(h_expr.right, h_context);
						switch(h_expr.operator) {
							case '+': return z_lhs + z_rhs;
							case '-': return z_lhs - z_rhs;
							case '*': return z_lhs * z_rhs;
							case '/': return z_lhs / z_rhs;
							case '%': return z_lhs % z_rhs;
							case '<': return z_lhs < z_rhs;
							case '>': return z_lhs > z_rhs;
							case '<=': return z_lhs <= z_rhs;
							case '>=': return z_lhs >= z_rhs;
							case '==': return z_lhs == z_rhs;
							case '!=': return z_lhs != z_rhs;
							case '&&': return z_lhs && z_rhs;
							case '||': return z_lhs || z_rhs;
							case '>>>': return z_lhs >>> z_rhs;
							case '>>': return z_lhs >> z_rhs;
							case '<<': return z_lhs << z_rhs;
							case '&': return z_lhs & z_rhs;
							case '|': return z_lhs | z_rhs;
							default: {
								debugger;
								throw `unrecognized binary operator: ${h_expr.operator}`;
							}
						}
					}
					case 'unary_expression': {
						let z_expr = this.evaluate(h_expr.expression, h_context);
						switch(h_expr.operator) {
							case '-': return -z_expr
							case '!': return !z_expr;
							default: {
								debugger;
								throw `unrecognized unary operator: '${h_expr.operator}'`;
							}
						}
					}
					case 'ternary_condition': {
						if(this.evaluate(h_expr.if, h_context)) {
							return this.evaluate(h_expr.then, h_context);
						}
						else {
							return this.evaluate(h_expr.else, h_context);
						}
					}
					default:
						debugger;
						break;
				}
			},

			call_macro(s_macro, a_args) {
				let h_macro = this.macros[s_macro];
				let s_output = '';

				let h_context = Object.create(this.global);
				if(!h_macro) {
					// built-in function
					if(H_BUILTIN_FUNCTIONS[s_macro]) {
						return H_BUILTIN_FUNCTIONS[s_macro](...a_args);
					}

					debugger;
					throw new Error(`no such macro defined: ${s_macro}`);
				}

				let a_params = h_macro.params;
				a_params.forEach((h_param, i_param) => {
					h_context[h_param.name] = (a_args.length > i_param)
						? a_args[i_param]
						: (h_param.default
							? this.evaluate(h_param.default)
							: null);
				});

				let a_body = h_macro.body;
				let ne_body = a_body.length - 1;
				a_body.forEach((h_section, i_section) => {
					s_output += h_program[h_section.type].apply(this, [h_section, h_context]);
				});

				return s_output;
			},
		};


		// process each section
		a_sections.forEach((h_section) => {
			h_states.output += h_program[h_section.type].apply(h_states, [h_section, h_states.global]);
		});

		return h_states;
	};
};
