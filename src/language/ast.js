
const assembler = require('./assembler');

module.exports = {
	Program: (a_sections) => assembler(a_sections),
};
