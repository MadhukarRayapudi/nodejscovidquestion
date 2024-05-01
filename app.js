const express = require('express')
const app = express()
app.use(express.json())
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
  }
}

initializeDBAndServer()

//login user API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  // console.log(username, password)
  const selectUserQuery = `
    SELECT * FROM user WHERE username = "${username}";
  `
  const dbUser = await db.get(selectUserQuery)

  if (dbUser === undefined) {
    // response.status(401)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'my_secret_token')
      // response.status(200)
      response.send({jwtToken})
    } else {
      // response.status(401)
      response.send('Invalid password')
    }
  }
})

//Authentication with token middleware
const authenticateToken = (request, response, next) => {
  let jwtToken

  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
    // console.log(jwtToken)
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'my_secret_token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        // request.stateName = payload.username;
        next()
      }
    })
  }
}

//get states API
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state ORDER BY state_id;
  `

  const statesArray = await db.all(getStatesQuery)

  const convertDbObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }

  response.send(
    statesArray.map(eachState => convertDbObjectToResponseObject(eachState)),
  )
})

//get specific state
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params

  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};
  `

  const convertDbObjectToResponseObject = dbObject => {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    }
  }

  const dbState = await db.get(getStateQuery)

  response.send(convertDbObjectToResponseObject(dbState))
})

//creating a new district
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const createDistrictQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES (
      "${districtName}", 
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    )
  `

  await db.run(createDistrictQuery)
  response.send('District Successfully Added')
})

//get specific district
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const getDistrictQuery = `
    SELECT * from district WHERE district_id = ${districtId};
  `
    const convertDbObjectToResponseObject = dbObject => {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      }
    }

    const dbDistrict = await db.get(getDistrictQuery)

    response.send(convertDbObjectToResponseObject(dbDistrict))
  },
)

//delete a district
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};
  `

    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//update a district
app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrictQuery = `
    UPDATE district SET district_name = "${districtName}",
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};
  `

    await db.run(updateDistrictQuery)

    response.send('District Details Updated')
  },
)

//get stats
app.get(
  'states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params

    const selectStateQuery = `
    SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId};
  `
    const convertDbObjectToResponseObject = dbObject => {
      return {
        
      }
    }

    const stats = await db.get(selectStateQuery)
    response.send(stats)
  },
)

module.exports = app
