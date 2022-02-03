const express = require('express');
const handlebars = require('express-handlebars');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const logger = require('morgan');
const session = require('express-session');
const MongoDBStore = require("connect-mongodb-session")(session);
const flash = require('connect-flash');
const colors = require('colors')
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');

const connectDB = require('./config/db');
const app = express();
const strategy = require('./middlewares/strategy')
const flashConfig = require('./middlewares/flashConfig')
// Import Routes files
const cubeRoutes = require("./routes/cube");
const accessoryRoutes = require('./routes/accessory');
const authRoutes = require('./routes/auth')

// Environment variables 
dotenv.config({path:"./config/config.env"});
// Configure the server PORT 
const port = process.env.PORT || 3000;
// Connect to DB
connectDB(); 


// Configure multer 
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'images') }, 
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname) }
  
})

const fileFilter = (req, file, cb) => {
  const condition =
		(file.mimetype === "image/png" ||
		file.mimetype === "image/jpeg" ) 
  console.log(file)
  if (condition ) { 
    cb(null, true)
  }else {
    cb(null, false)
  }

}

app.use(helmet())
app.use(compression());

app.use(multer({ storage: fileStorage, fileFilter: fileFilter, limits: {fileSize:1024*1024}}).single('imageUrl'))
// Setup Template Engine 
app.engine('hbs', handlebars({
  extname: '.hbs', 
  partialsDir: path.join(__dirname, 'views', 'partials'),
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    },
}))

app.set('view engine', 'hbs')


// setting up the session storage in DB
const store = new MongoDBStore({
	uri: process.env.MONGO_URL,
	collection: "sessions",
	expires: 1000 * 60*60 , //
});

app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false,
    saveUninitialized: false,
    store: store
	})
);

app.use(flash())

// Custome middleware
app.use(strategy)
app.use(flashConfig)


// Middlewears 
app.use(express.static('static'));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(bodyParser.urlencoded({ extended: false }))

// Setup the logger 
if (process.env.NODE_ENV === 'development') {
  app.use(logger('dev'))
} else { 
  const logStream = fs.WriteStream(path.join(__dirname, 'logs', 'access.log'), {flags:'a'})
  app.use(logger('combined', {stream:logStream}))
}

// load the routes
app.use(cubeRoutes)
app.use(accessoryRoutes);
app.use(authRoutes);

// load page not found
app.use((req, res) => { 
    res.render('404.hbs')
})



// Express error handling 
app.use((error, req, res, next) => { 
  res.render('500.hbs', {error})
})


const server = app.listen(port, console.log(`server running on port ${process.env.PORT} ...`.yellow.underline))

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => { 
  console.log(err);
  console.log(`Error:${err}`.red);
  server.close(() => { 
    console.log(`Server has been stopped...`.red.underline);
    process.exit(1)
  })
})