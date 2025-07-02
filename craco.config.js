const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Clear any existing @ alias and set it correctly
      webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
      webpackConfig.resolve.alias['@'] = path.resolve(__dirname, 'src');
      return webpackConfig;
    },
  },
};
