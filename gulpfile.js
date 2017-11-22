
// gulp
const gulp = require('gulp');
const soda = require('gulp-soda');

// gulp user-level config
let user_config = {};
try { user_config = require('./config.user.js'); }
catch(e) {}

// specify how config targets map to tasks
soda(gulp, {

	// global config object
	config: user_config,

	//
	inputs: {
		debug: 'js',
		language: 'language',
		main: ['js', 'test'],
	},

	//
	targets: {
		// direct javascript
		js: [
			'copy',
			'develop: copy',
		],

		// testable
		test: [
			'istanbul',
			'mocha: istanbul',
		],

		// compiling language compiler from jison
		language: [
			'jison:copy',
			'copy',
			'develop:jison',
		],

		// generate tm text highlighting files
		'syntax-highlighting': [
			'[all]: sublime ace-mode',
			'ace-mode:tm-language',
			'sublime:tm-language',
			'tm-language:tm-preferences',
			'tm-preferences:clean',
			'develop: all',
		],
	},

	options: {
		copy: {
			glob: '*.js',
		},
		'*': {
			test_src: [
				'test/main/jmacs.js',
			],
		},
	},

	aliases: {
		test: ['mocha'],
	},
});
