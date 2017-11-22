
//
const H_MATH_OPS = {
	'+': (a, b) => a + b,
	'-': (a, b) => a - b,
	'*': (a, b) => a * b,
	'/': (a, b) => a / b,
};

const assembler = require('./assembler');

module.exports = {

	push(a_list, z_item) {
		if(undefined === z_item && !a_list.length) return a_list;
		a_list.push(z_item);
		return a_list;
	},

	append(a_appendage, a_primary) {
		console.warn(typeof a_primary+': '+a_primary);
		return a_primary.concat(a_appendage);
	},

	merge(h_a, h_b) {
		for(let s_key in h_a) {
			h_b[s_key] = h_a[s_key];
		}
		return h_b;
	},

	option(h_pass, z_if, s_key) {
		if(z_if) h_pass[s_key] = true;
		return h_pass;
	},

	BooleanValue: (b_value) => ({
		type: 'boolean',
		value: b_value
	}),

	NumberValue: (s_num) => ({
		type: 'number',
		value: +s_num,
	}),

	StringValue: (s_str) => ({
		type: 'string',
		value: s_str.slice(1, -1),
	}),

	Variable: (s_name) => ({
		type: 'variable',
		name: s_name,
	}),

	Inline: (h_expression) => ({
		type: 'inline',
		expression: h_expression,
	}),

	MacroCall: (s_macro, a_args) => ({
		type: 'call',
		macro: s_macro,
		args: a_args,
	}),

	Assignment: (s_name, h_expression) => ({
		type: 'assignment',
		name: s_name,
		expression: h_expression,
	}),

	If: (h_expression, a_body, a_elseifs, a_else_body) => ({
		type: 'if',
		if: h_expression,
		then: a_body,
		elseifs: a_elseifs,
		else: a_else_body,	
	}),

	Elseif: (h_expression, a_body) => ({
		type: 'elseif',
		if: h_expression,
		then: a_body,
	}),

	UnaryExpr: (s_operator, h_expression) => ({
		type: 'unary_expression',
		operator: s_operator,
		expression: h_expression,
	}),

	BinaryExpr: (h_left, s_operator, h_right) => ({
		type: 'binary_expression',
		operator: s_operator,
		left: h_left,
		right: h_right,
	}),

	TernaryCondition: (h_if, h_then, h_else) => ({
		type: 'ternary_condition',
		if: h_if,
		then: h_then,
		else: h_else,
	}),

	Include: (h_file) => ({
		type: 'include',
		file: h_file,
	}),

	Repeat: (h_expression, a_body) => ({
		type: 'repeat',
		times: h_expression,
		body: a_body,
	}),

	Not: (h_expression) => ({
		type: 'not',
		expression: h_expression,
	}),

	Expression(h_lhs, h_operation, h_ternary) {
		// no rhs
		if(!h_operation) {
			// no ternary
			if(!h_ternary) return h_lhs;
			// yes ternary
			else return {
				type: 'ternary_condition',
				if: h_lhs,
				then: h_ternary.then,
				esle: h_ternary.else,
			};
		}

		// ref rhs
		let h_rhs = h_operation.rhs;

		// ref operator
		let s_operator = h_operation.operator;

		// operation is statically evaluatable
		if(H_MATH_OPS[s_operator]) {
			// lhs is constant
			if('constant' === h_lhs.type) {
				// replace with constant
				h_lhs = h_immediate_constants[h_lhs.value];
			}

			// rhs is constant
			if('constant' === h_rhs.type) {
				// replace with constant
				h_rhs = h_immediate_constants[h_rhs.value];
			}

			// both types are numeric
			if('number' === h_lhs.type && 'number' === h_rhs.type) {
				// execute operation
				return {
					type: 'number',
					value: H_MATH_OPS[s_operator](h_lhs.value, h_rhs.value),
				};
			}
		}

		// build normal lhs/rhs
		let h_expr = {
			type: 'operation',
			operator: s_operator,
			left: h_lhs,
			right: h_rhs,
		};

		if(h_ternary) {
			return {
				type: 'ternary_condition',
				if: h_expr,
				then: h_ternary.then,
				else: h_ternary.else,
			};
		}

		return h_expr;
	},

	Operation: (s_operator, h_rhs) => ({
		operator: s_operator,
		rhs: h_rhs,
	}),

	Parameter: (s_name, h_default) => ({
		type: 'parameter',
		name: s_name,
		default: h_default,
	}),

	Macro: (s_name, a_params, h_body) => ({
		type: 'macro',
		name: s_name,
		params: a_params,
		body: h_body,
	}),

	Verbatim: (s_verbatim) => ({
		type: 'verbatim',
		value: s_verbatim,
	}),

	Program: (a_sections) => assembler(a_sections),
};
