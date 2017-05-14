import Express from 'express'
import BodyParser from 'body-parser'
import CookieParser from 'cookie-parser'

import Low from 'lowdb'

import Passport from 'passport'
import PassportLocal from 'passport-local'
import ExpressSession from 'express-session'

import Joi from 'joi'
import BCrypt from 'bcrypt-nodejs'

function ensureLoggedIn(req, res, next) {
  console.log('json-api-server', 'ensureLoggedIn', 'req.isAuthenticated', req.isAuthenticated(), 'req.user', req.user)

  if (req.isAuthenticated() || (req.user && req.user.id > 0)) {
    console.log('json-api-server', 'ensureLoggedIn', 'req.user.id', req.user.id)

    next()
  } else {
    return res.json({ message: 'FAIL', invalidLogin: true })
  }
}

function ensureManager(req, res, next) {
  console.log('json-api-server', 'ensureManager', 'user', req.user)

  let type = req.user.type

  if (type === 'MANAGER' || type === 'ADMIN') {
    next()
  } else {
    return res.json({ message: 'FAIL', invalidPermissions: true })
  }
}

const userSchema = Joi.object().keys({
  userName: Joi.string().token().min(3).max(30).required(),  
  password: Joi.string().token().min(3).max(30),
  type: Joi.string().valid(['REGULAR', 'MANAGER', 'ADMIN']),
})
const newUserSchema = Joi.object().keys({
  userName: Joi.string().token().min(3).max(30).required(),  
  password: Joi.string().token().min(3).max(30).required(),
  type: Joi.string().valid(['REGULAR', 'MANAGER', 'ADMIN']),
})
const tripSchema = Joi.object().keys({
  destination: Joi.string().min(3).max(30).required(),  
  startDate: Joi.number().min(1000000000000).max(2000000000000).required(),
  endDate: Joi.number().min(1000000000000).max(2000000000000).required(),
  comment: Joi.string().allow('').optional(),
  userId: Joi.number().optional()
})

function ensureValidUser(req, res, next) {
  console.log('json-api-server', 'ensureValidUser', 'req.body', req.body)

  const validationResult = Joi.validate(req.body, userSchema)

  if (validationResult.error === null) {
    next()
  } else {
    console.log('json-api-server', 'ensureValidUser', 'validationResult.error.details[0].path', validationResult.error.details[0].path)

    if (path === 'userName') {
      return res.json({ message: 'FAIL', invalidUserName: true })
    } else if (path === 'type') {
      return res.json({ message: 'FAIL', invalidType: true })
    } else {
      return res.json({ message: 'FAIL' })
    }
  }
}
function ensureValidNewUser(req, res, next) {
  console.log('json-api-server', 'ensureValidNewUser', 'req.body', req.body)

  const validationResult = Joi.validate(req.body, newUserSchema)

  if (validationResult.error === null) {
    next()
  } else {
    let path = validationResult.error.details[0].path
    console.log('json-api-server', 'ensureValidNewUser', 'validationResult.error.details[0].path', path)

    if (path === 'userName') {
      return res.json({ message: 'FAIL', invalidUserName: true })
    } else {
      return res.json({ message: 'FAIL', invalidPassword: true })
    }
  }
}
function ensureValidTrip(req, res, next) {
  console.log('json-api-server', 'ensureValidTrip', 'req.body', req.body)

  const validationResult = Joi.validate(req.body, tripSchema)

  if (validationResult.error === null && req.body.startDate < req.body.endDate) {
    next()
  } else if (validationResult.error !== null) {
    let path = validationResult.error.details[0].path
    console.log('json-api-server', 'ensureValidNewUser', 'validationResult.error.details[0].path', path)

    return res.json({ message: 'FAIL', invalid: path })
  } else {
    return res.json({ message: 'FAIL', invalidRange: true })
  }
}

function createHash(password) {
  return BCrypt.hashSync(password, BCrypt.genSaltSync(10), null)
}
function isValidPassword(user, password) {
  return BCrypt.compareSync(password, user.password)
}

export default (PORT) => {
  const app = Express()

  let Strategy = PassportLocal.Strategy
  Passport.use(new Strategy(function(userName, password, cb) {
    console.log('STRATEGY', 'userName', userName, 'password', password)

    if (userName.length > 2 && password.length > 2) {
      let userObj = db.get('users').find({ user_name: userName }).value()
      let exists = userObj !== undefined

      if (exists && isValidPassword(userObj, password)) {
        return cb(null, userObj)
      } else if (!exists) {
        return cb(null, false, { invalidUserName: true })
      } else {
        return cb(null, false, { invalidPassword: true })
      }
    } else if (userName.length < 3) {
      return cb(null, false, { invalidUserName: true })
    } else {
      return cb(null, false, { invalidPassword: true })
    }
  }))
  Passport.serializeUser(function(user, cb) {
    //console.log('passport', 'serializeUser', 'user.id', user.id, typeof user.id)
    cb(null, user.id)
  })
  Passport.deserializeUser(function(id, cb) {
    //console.log('passport', 'deserializeUser', 'id', id, typeof id)
    let userObj = db.get('users').find({ id: id }).value()
    //console.log('passport', 'deserializeUser', 'userObj[userName]', userObj['user_name'])
    cb(null, userObj)
  })

  app.use(Express.static(__dirname+'/dist'))

  //app.use(require('morgan')('combined'))

  app.use(CookieParser())
  
  app.use(BodyParser.urlencoded({ extended: true }))
  app.use(BodyParser.json())

  app.use(ExpressSession({ secret: 'toptal', resave: false, saveUninitialized: false, cookie: {}, name: 'interview' }))

  app.use(Passport.initialize())
  app.use(Passport.session())

  const db = Low('db.json')
  db.defaults({ users: [], max_id: 0, max_trip_id: 0 }).write()

  const router = Express.Router()


  // POST /LOGIN
  router.post('/login', function(req, res) {
    console.log('POST', '/login')

    Passport.authenticate('local', function(err, user, info) {
      console.log('authenticate', 'err', err, 'user', user, 'info', info)

      if (user === false && info.message) {
        console.log('authenticate', 'A', req.body.username.length === 0)
        if (req.body.username.length === 0) {
          res.json({ message: 'FAIL', invalidUserName: true })
        } else {
          res.json({ message: 'FAIL', invalidPassword: true })
        }
        res.end()
        //next()
      } else if (user === false) {
        console.log('authenticate', 'B')
        res.json(Object.assign({ message: 'FAIL' }, info))
      } else {
        console.log('authenticate', 'C')

        console.log('POST', '/login', user.id)

        let dataObj = Object.assign({}, user)
        req.login(user, loginErr => {
          if (loginErr) {
            res.json(Object.assign({ message: 'FAIL', invalidUserName: true }))
          }
          return res.json({ message: 'SUCCESS', data: dataObj })
        })
      }
    })(req, res)
  })
  
  // GET /LOGOUT
  router.get('/logout', function(req, res) {
    req.logout()
    res.json({ message: 'SUCCESS' })
  })


  // GET /USER
  router.get('/users', ensureLoggedIn, ensureManager, function(req, res) {
    let users = db.get('users').value()

    res.json({ message: 'SUCCESS', data: users })
  })

  // POST /USER
  router.post('/users', ensureValidNewUser, function(req, res) {
    console.log('POST', '/users', req.body)

    let userName = req.body.userName
    let password = createHash(req.body.password)
    let type = req.body.type // REGULAR, MANAGER, ADMIN

    let maxId = db.get('max_id').value()
    let exists = db.get('users').find({ user_name: userName }).value() !== undefined

    console.log('POST', '/users', 'userName', userName, 'password', password, 'type', type, 'maxId', maxId, 'exists', exists)

    if (!exists) {
      console.log('POST', '/users', 'SUCCESS')

      let newRow = { id: maxId+1, user_name: userName, password: password, trips: [], type: type }
      db.get('users').push(newRow).write()      
      db.set('max_id', maxId+1).write()

      res.json({ message: 'SUCCESS', data: newRow })
    } else {
      res.json({ message: 'FAIL' })
    }

    console.log('POST', '/users', 'exists', exists === undefined)
  })

  // DELETE /USER
  router.delete('/users/:userId', ensureLoggedIn, ensureManager, function(req, res) {
    let userId = parseInt(req.params['userId'])

    console.log('DELETE', '/users/:userId', 'userId', userId)

    let result = db.get('users').remove({ id: userId }).write()
    console.log('DELETE', '/users/:userId', 'result', result) 

    if (result.length > 0) {
      let updatedUsers = db.get('users').value()
      res.json({ message: 'SUCCESS', data: updatedUsers })
    } else {
      res.json({ message: 'FAIL', invalidUserId: true })
    }
  })

  // PUT /USERS/:USERID
  router.put('/users/:userId', ensureLoggedIn, ensureManager, ensureValidUser, function(req, res) {
    let userId = parseInt(req.params['userId'])
    console.log('PUT', '/users/:userId', 'userId', userId) 

    let id = req.user.id
    let userName = req.body.userName
    let type = req.body.type
    console.log('PUT', '/users/:userId', 'id', id, 'userName', userName, 'type', type) 

    let result
    if (id === userId) {
      result = db.get('users').find({ id: userId })
        .assign({ user_name: userName })
        .write()
    } else {
      result = db.get('users').find({ id: userId })
        .assign({ user_name: userName, type: type })
        .write()
    }
    console.log('PUT', '/users/:userId', 'result', result) 

    if (result.id > 0) {
      let updatedUsers = db.get('users').value()
      res.json({ message: 'SUCCESS', data: updatedUsers })
    } else {
      res.json({ message: 'FAIL', invalidUserId: true })
    }
  })


  // GET /TRIPS
  router.get('/trips', ensureLoggedIn, function(req, res) {
    let userId = req.user.id
    let userType = req.user.type

    console.log('GET', '/trips', 'userId', userId, 'userType', userType)

    if (userType === 'ADMIN') {
      let dataObj = db.get('users').find({ id: userId }).value()
      let trips = db.get('users').map('trips').flatten().value()  

      console.log('GET', '/trips', 'trips', trips)

      res.json({ message: 'SUCCESS', data: dataObj, moreData: trips })
    } else {
      let dataObj = db.get('users').find({ id: userId }).value()
      res.json({ message: 'SUCCESS', data: dataObj })
    }
  })

  // POST /TRIPS
  router.post('/trips', ensureLoggedIn, ensureValidTrip, function(req, res) {
    let userId = req.user['id']

    let userType = req.user['type']
    if (userType === 'ADMIN' && req.body.userId) {
      userId = parseInt(req.body.userId)
    }

    console.log('POST', '/trips', 'userId', userId, 'userType', userType)

    let destination = req.body.destination
    let startDate = parseInt(req.body.startDate)
    let endDate = parseInt(req.body.endDate)
    let comment = req.body.comment || ''

    let maxId = db.get('max_trip_id').value()

    let user = db.get('users').find({ id: userId })
    console.log('POST', '/trips', 'user', user.value())

    let trips = user.get('trips')
    console.log('POST', '/trips', 'trips', trips.value())

    let newRow = { id: maxId+1, destination: destination, start_date: startDate, end_date: endDate, comment: comment }
    trips.push(newRow).write()      

    db.set('max_trip_id', maxId+1).write()

    let updatedUser = db.get('users').find({ id: userId }).value()
    res.json({ message: 'SUCCESS', data: updatedUser })
  })

  // DELETE /TRIPS/:TRIPID
  router.delete('/trips/:tripId', ensureLoggedIn, function(req, res) {
    let tripId = parseInt(req.params['tripId'])
    let userId = req.user['id']
    let userType = req.user['type']

    console.log('DELETE', '/trips/:tripId', 'tripId', tripId, 'userId', userId, 'userType', userType) 

    let result
    if (userType === 'ADMIN') {
      let users = db.get('users').value()
      let realUserId = ''
      users.forEach(function(el) {
        el.trips.forEach(function(innerEl) {
          if (innerEl.id === tripId) {
            realUserId = el.id
          }
        })
      })
      result = db.get('users').find({ id: realUserId }).get('trips').remove({ id: tripId }).write()
    } else {
      result = db.get('users').find({ id: userId }).get('trips').remove({ id: tripId }).write()
    }
    console.log('DELETE', '/trips/:tripId', 'result', result) 

    if (result.length > 0) {
      let updatedUser = db.get('users').find({ id: userId }).value()
      let jsonObj = { message: 'SUCCESS', data: updatedUser }

      let up

      res.json({ message: 'SUCCESS', data: updatedUser })
    } else {
      res.json({ message: 'FAIL', invalidPermissions: true })
    }
  })

  // PUT /TRIPS/:TRIPID
  router.put('/trips/:tripId', ensureLoggedIn, ensureValidTrip, function(req, res) {
    let tripId = parseInt(req.params['tripId'])
    let userId = req.user['id']
    let userType = req.user['type']

    console.log('PUT', '/trips/:tripId', 'tripId', tripId, 'userId', userId, 'req.body', req.body, 'userType', userType) 

    let destination = req.body.destination
    let startDate = parseInt(req.body.startDate)
    let endDate = parseInt(req.body.endDate)
    let comment = req.body.comment || ''

    console.log('PUT', '/trips/:tripId', 'destination', destination, 'startDate', startDate, 'endDate', endDate) 

    let result
    let allTrips = []
    if (userType === 'ADMIN') {
      let users = db.get('users').value()
      let realUserId = ''
      users.forEach(function(el) {
        el.trips.forEach(function(innerEl) {
          if (innerEl.id === tripId) {
            realUserId = el.id
          }
        })
      })
      result = db.get('users').find({ id: realUserId }).get('trips').find({ id: tripId })
        .assign({ destination: destination, start_date: startDate, end_date: endDate, comment: comment })
        .write()
        
      let trips = db.get('users').map('trips').value()  
      trips.forEach(function(el) {
        el.forEach(function(innerEl) {
          allTrips.push(innerEl)
        })
      })
    } else {
      result = db.get('users').find({ id: userId }).get('trips').find({ id: tripId })
        .assign({ destination: destination, start_date: startDate, end_date: endDate, comment: comment })
        .write()
    }
    console.log('PUT', '/trips/:tripId', 'result', result) 

    if (result.id > 0) {
      let updatedUser = db.get('users').find({ id: userId }).value()

      res.json({ message: 'SUCCESS', data: updatedUser, moreData: allTrips })
    } else {
      res.json({ message: 'FAIL', invalidPermissions: true })
    }
  })

  app.use('/api', router)

  console.log('json-api-server', 'PORT', PORT)

  app.listen(PORT)
};
