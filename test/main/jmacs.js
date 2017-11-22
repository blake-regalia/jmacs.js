const assert = require('assert');
const deq = assert.deepStrictEqual;
const eq = (z_expect, z_actual) => {
	assert.strictEqual(z_actual, z_expect);
};
const fs = require('fs');

const jmacs = require('../../dist/main/jmacs.js');


function compile(s_input, p_cwd='./') {
	let h_result = jmacs.compile({
		input: s_input,
		cwd: p_cwd,
	});

	if('string' !== typeof h_result.output) {
		console.error(h_result);
	}

	let a_lines = h_result.output.trim().split(/\s*\n\s*/);
	if(1 === a_lines.length) return a_lines[0];
	return a_lines;
}

describe('parsing', () => {
	it('verbatim', () => {
		let s_verbatim = '';
		for(let i=10; i<255; i++) s_verbatim += String.fromCodePoint(i);
		eq(s_verbatim.trim(), compile(s_verbatim));
	});

	it('assignment and referencing', () => {
		eq('1 2 three', compile(`
			@set one 1
			@set two 2
			@set three 'three'
			@{one} @{two} @{three}
		`));
	});

	it('binary operations', () => {
		eq('3 6 2 3 8 1 2 7 0', compile(`
			@{1 + 2} @{2 * 3} @{4 / 2} @{5 - 2} @{1 << 3} @{8 >> 3} @{16 >>> 3} @{5 | 2} @{6 & 1}
		`));
	});
});

describe('functions', () => {
	function call(s_method, ...a_args) {
		let s_script = `
			@set hello 'hello'

			@def exclaim(say='sup')
				@{say}!
			@end

			@def mutate(value)
				@set hello value
			@end

			@def test_mutate(replace)
				@{mutate(replace)}
				@{hello}
			@end

			@def flip(a, b)
				@{b} @{a}
			@end

			@{${s_method}(${a_args.join(', ')})}
		`;

		// console.info(s_script);

		return compile(s_script);
	}

	it('default arg', () => {
		eq('sup!', call('exclaim'))
	});

	it('pass string arg', () => {
		eq('yes!', call('exclaim', `'yes'`));
	});

	it('pass concat expr arg', () => {
		eq('hello world!', call('exclaim', `hello+' world'`))
	});

	it('pass add expr arg', () => {
		eq('hi 2 u!', call('exclaim', `'hi '+(1+1)+' u'`));
	});

	it('mutate', () => {
		eq('goodbye', call('test_mutate', `'goodbye'`));
	});

	it('two args', () => {
		eq('that this', call('flip', `'this'`, `'that'`));
	});
});


describe('logic', () => {
	function call(s_method, ...a_args) {
		return compile(`
			@def word(num)
				@if num == 1
					one
				@elseif num == 2
					two
				@else
					nothing
				@end
			@end

			@{${s_method}(${a_args.join(', ')})}
		`);
	}

	it('ternary ?', () => {
		eq('1', compile('@{true? 1: 0}'));
	});

	it('if', () => {
		eq('one', call('word', '1'));
	});

	it('elseif', () => {
		eq('two', call('word', '2'));
	});

	it('else', () => {
		eq('nothing', call('word', '0'));
	});

	it('truthy', () => {
		eq('yes', compile(`@{'truthy'? 'yes': 'no'}`));
	});

	it('truthy negative', () => {
		eq('no', compile(`@{!'truthy'? 'yes': 'no'}`));
	});
});

describe('Math', () => {
	it('pi', () => {
		eq((Math.PI*2)+'', compile('@{PI * 2}'));
	});

	it('floor', () => {
		eq('2', compile('@{floor(10 / 4)}'));
	});

	it('ceil', () => {
		eq('3', compile('@{ceil(10 / 4)}'));
	});
});

describe('String', () => {
	function call(s_method, ...a_args) {
		let s_script = `
			@set word 'hello'
			@{${s_method}(word${a_args.map(s => ','+s).join('')})}
		`;
	
		return compile(s_script);
	}

	it('length', () => {
		eq('5', call('length'));
	});

	it('charAt', () => {
		eq('h', call('charAt', 0));
	});

	it('replace', () => {
		eq('hey', call('replace', `'llo'`, `'y'`));
	});
});

