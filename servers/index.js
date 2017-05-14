import appServer from './webpack-server'
import apiServer from './json-api-server'

const PORT = 8080

apiServer(PORT-1)
appServer(PORT)
