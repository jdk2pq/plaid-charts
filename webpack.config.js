const path = require('path');

module.exports = {
	entry: './src/entry.ts',
	mode: 'development',
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
	resolve: {
		extensions: [ '.tsx', '.ts', '.js' ]
	},
	output: {
		filename: './bundle.js',
		path: path.resolve(__dirname, 'public')
	},
	devtool: 'inline-source-map',
};
