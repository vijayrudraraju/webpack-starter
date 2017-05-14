import webpack from 'webpack'
import config from '../webpack.config'
import WebpackDevServer from 'webpack-dev-server'

export default (PORT) => {
  const server = new WebpackDevServer(webpack(config), {
    proxy: {
      '*': `http://localhost:${PORT-1}`
    }
  })
  server.listen(PORT, 'localhost')
}
