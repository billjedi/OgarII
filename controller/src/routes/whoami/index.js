const config = require('../../config')
const PATH = config.basePath('/whoami/')
const restify = require('restify')

module.exports = (server) => {
    server.get(PATH, restify.plugins.conditionalHandler([
        {version: '1.0.0', handler: require('./v1')}
    ]))
}