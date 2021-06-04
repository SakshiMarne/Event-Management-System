var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var paginate = require('express-paginate');
var Hashids = require("hashids");
//Last modified and tested by Rohit Maurya
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const checksum_lib = require("./paytm/checksum");
const parseUrl = express.urlencoded({ extended: false });
const parseJson = express.json({ extended: false });
var config = require('config',"./paytm/config");

// mongoose
mongoose.connect(config.get('dbhost'), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify:false,
});

var Account = require('./models/account');

var index = require('./routes/index');
var users = require('./routes/users');
var events = require('./routes/events');
var teams = require('./routes/teams');
var admin = require('./routes/admin');
var sitemap = require('./routes/sitemap');
var userLogic = require('./logic/userLogic');
var app = express();

var hashids = new Hashids(config.get('hashids').secret, config.get('hashids').no_chars, config.get('hashids').chars);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');


app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.disable('x-powered-by');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(session({
    secret: config.get('sessionSecret'),
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
        mongooseConnection: mongoose.connection,
        ttl: 24 * 60 * 60 // = 1 day expiry
    })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.use(paginate.middleware(10, 50));

app.get('*', userLogic.setLoginStatus);
app.use('/', index);
app.use('/', admin);
app.use('/', sitemap);
app.use('/users', users);
app.use('/events', events);
app.use('/teams', teams);

// passport config
passport.use(Account.createStrategy());
passport.use(new FacebookStrategy({
        clientID: config.get('fb').clientID,
        clientSecret: config.get('fb').clientSecret,
        callbackURL: config.get('fb').callbackURL,
        profileFields: ['id', 'displayName', 'picture.type(large)', 'emails', 'name', 'gender']
    },
    function (accessToken, refreshToken, profile, done) {
        Account.findOne({'providerData.id': profile.id},
            function (err, user) {
                if (err) {
                    return done(err);
                }
                //No user found
                if (!user) {
                    user = new Account({
                        firstName: profile.name.givenName,
                        lastName: profile.name.familyName,
                        gender: profile.gender,
                        email: profile.emails[0].value || null,
                        photo: profile.photos[0].value || null,
                        provider: 'facebook',
                        providerData: profile._json,
                        accessToken: accessToken,
                        is_new: true
                    });
                    user.save(function (err) {
                        if (err) console.log(err);
                        user.mit_id = 'I' + hashids.encode(user.accNo);
                        user.save(function(err) {
                            return done(err, user);
                        });
                    });
                } else {
                    return done(err, user);
                }
            })
    }
));
app.post("/payment", [parseUrl, parseJson], (req, res) => {
    // Route for making payment
  
    var paymentDetails = {
      amount: req.body.amount,
      customerId: req.body.name,
      customerEmail: req.body.email,
      customerPhone: req.body.phone
  }
  if(!paymentDetails.amount || !paymentDetails.customerId || !paymentDetails.customerEmail || !paymentDetails.customerPhone) {
      res.status(400).send('Payment failed')
  } else {
      var params = {};
      params['MID'] = 'RlOVUg10847632676973';
      params['WEBSITE'] = 'WEBSTAGING';
      params['CHANNEL_ID'] = 'WEB';
      params['INDUSTRY_TYPE_ID'] = 'Retail';
      params['ORDER_ID'] = 'TEST_'  + new Date().getTime();
      params['CUST_ID'] = paymentDetails.customerId;
      params['TXN_AMOUNT'] = paymentDetails.amount;
      params['CALLBACK_URL'] = 'http://localhost:3000';
      params['EMAIL'] = paymentDetails.customerEmail;
      params['MOBILE_NO'] = paymentDetails.customerPhone;
  
  
      checksum_lib.genchecksum(params, "Bm4KJZ@@V&n4kjBq", function (err, checksum) {
          var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
          // var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
  
          var form_fields = "";
          for (var x in params) {
              form_fields += "<input type='hidden' name='" + x + "' value='" + params[x] + "' >";
          }
          form_fields += "<input type='hidden' name='CHECKSUMHASH' value='" + checksum + "' >";
  
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="' + txn_url + '" name="f1">' + form_fields + '</form><script type="text/javascript">document.f1.submit();</script></body></html>');
          res.end();
      });
  }
  });
passport.serializeUser(function(user, done) {
    done(null, user._id);
});
passport.deserializeUser(function(id, done) {
    Account.findOne({_id: id}, function(err, user) {
        done(err, user);
    });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
/*
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}
*/

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    if (!err.status || err.status === 500) {
        console.error(err, 'Unknown Error')
    }
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: err
    });
});

module.exports = app;
