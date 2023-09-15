//-------------------- ALL IMPORTS ------------------------
var express = require("express");
var bodyParser = require("body-parser");
const mongoose = require("mongoose");
var _ = require("lodash");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findorcreate = require("mongoose-findorcreate");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
require("dotenv").config();
//---------------------------------------------------------





//----------------- MIDDLEWARES ----------------------------
var app = express();
app.locals._ = _;

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"));
app.use(express.static("images"));

app.use(session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());
//-----------------------------------------------------------





//------------- DATABASE CONNECTIONS ------------------------
mongoose.connect("mongodb://127.0.0.1:27017/dsauserDB").then(() => console.log("Connected!"));

const topicSchema = new mongoose.Schema({
    topicname: String,
    content: [{ qname: String, link: String } ]
});
const topicModel = mongoose.model("topicModel", topicSchema);

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    googleid: String,
    githubid: String,
    data: [topicSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findorcreate);

const userModel = new mongoose.model("userModel", userSchema);

passport.use(userModel.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.email
      });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
//----------------------------------------------------------




//----------------- GOOGLE STRATEGY -----------------------

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/userhome"
  },
  function(accessToken, refreshToken, email, cb) {
    userModel.findOrCreate({ email : email._json.email, googleid: email.id, name: email.displayName}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/userhome", 
  passport.authenticate("google", { failureRedirect: "/commonhome" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  });
//----------------------------------------------------------





//---------------- GITHUB STRATEGY ------------------------

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/github/userhome"
  },
  function(accessToken, refreshToken, profile, done) {
    userModel.findOrCreate({ name: profile.displayName, username: profile.username, githubid: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/auth/github",
  passport.authenticate("github", { scope: [ "user:email" ] }));

app.get("/auth/github/userhome", 
  passport.authenticate("github", { failureRedirect: "/commonhome" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/");
  });

//---------------------------------------------------------





//------------------ AUTHENTICATION ------------------------

app.get("/auth/local", (req, res) => {
    res.render("auth/login");
});

app.post("/register",  (req, res)=>{
    const name = req.body.name;
    userModel.register({ username: req.body.username }, req.body.password, async (err, user)=>{
      if(err){
        console.log(err);
        res.redirect("/register");
      } 
      else{
        await userModel.updateOne({username: user.username}, {name: name}).exec();
        passport.authenticate("local")(req, res, () => {
          res.redirect('/userhome');
        })
      }
    })
})

app.get("/login", (req, res) => {
    res.render("auth/login");
});

app.post("/login", (req, res) => {
    const user = new userModel({
        email: req.body.username,
        password: req.body.password
    })
    req.login(user, function(err) {
        if (err) { 
            console.log(err);
            res.redirect("/login");
        }else{
            passport.authenticate("local")(req, res, () => {
                res.redirect('/userhome');
            });
        }
    });
});

app.post("/logout", (req, res) => {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect("/");
    });
})

//---------------------------------------------------------





//----------------- HOME ROUTES ---------------------------
app.get("/", async (req, res)=>{
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        res.redirect("/userhome");
    }
    else{
        res.render("commonhome");
    }
});

app.get("/userhome", async (req, res)=>{
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        res.render("userhome", {
            nameOfUser: curUser.name,
            topics: curUser.data
        })
    }else{
        res.redirect("/login");
    }
})

//---------------------------------------------------------





//------------ TOPIC MANAGEMENT ROUTES --------------------
app.get("/addtopic",(req, res)=>{
    if(req.isAuthenticated()){
        res.render("addtopic");
    }else{
        res.redirect("/login");
    }
});


app.post("/addnewtopic", async (req, res) => {
    if(req.isAuthenticated()){

        const topicName = req.body.topicname;
        const newTopic = new topicModel({ topicname: topicName });
        newTopic.save();
        const curUser = await userModel.findById(req.user.id).exec();
        curUser.data.push({topicname: topicName});
        curUser.save();
        res.redirect("/userhome");

    }else{
        res.redirect("/login");
    }
});

app.get("/removetopic", async (req, res)=>{
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        const userTopics = curUser.data;
        if(userTopics.length == 0){
            res.redirect("/");
        }
        res.render("removetopic",{
            t: userTopics
        });
    }
    else{
        res.redirect("/login");
    }        
});

app.post("/remove", async (req, res) => {
    if(req.isAuthenticated()){

        const curTopicName = req.body.rembtn;
        const curUser = await userModel.findById(req.user.id).exec();
        const topicArray = curUser.data;
        for(i = 0; i < topicArray.length; i++){
            if(topicArray[i].topicname === curTopicName){
                break;
            }
        }
        topicArray.splice(i, 1);
        curUser.save();
        res.redirect("/userhome");
    }
    else{
        res.redirect("/login");
    }
});

app.get("/topicwiselist/:list", async (req, res) => {
    if(req.isAuthenticated()){
        var x = req.params.list;
        const curUser = await userModel.findById(req.user.id).exec();
        const topicArray = curUser.data;
        for(i = 0; i < topicArray.length; i++){
            if(topicArray[i].topicname === x){
                break;
            }
        }
        res.render("topicwiselist",{
            topicname: x,
            topicData: topicArray[i],
            i: 1
        })
    }
    else{
        res.redirect("/login");
    }
    
});
//---------------------------------------------------------





//---------QUESTION MANAGEMENT ROUTES ---------------------

app.get("/addquestion", (req, res) => {
    if(req.isAuthenticated()){
        res.redirect("/newquestion");
    }else{
        res.redirect("/login");
    }
});

app.post("/addquestion", (req, res) => {
    if(req.isAuthenticated()){
        res.render("addquestion", {
            topicname: req.body.addq
        })
    }else{
        res.redirect("/login");
    }
});

app.post("/newquestion", async (req, res) => {
    if(req.isAuthenticated()){
        const topicName = req.body.nqb;
        const questionName = req.body.questionName;
        const questionLink = req.body.questionLink;

        const curUser = await userModel.findById(req.user.id).exec();
        const topicArray = curUser.data;
        for(i = 0; i < topicArray.length; i++){
            if(topicArray[i].topicname === topicName){
                break;
            }
        }
        topicArray[i].content.push({qname: questionName, link: questionLink});
        curUser.save();
        res.redirect("/topicwiselist/"+topicName);
    }
    else{
        res.redirect("/login");
    }
})

app.post("/removequestion", async (req, res) => {
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        const topicArray = curUser.data;
        for(i = 0; i < topicArray.length; i++){
            if(topicArray[i].topicname === req.body.rqb){
                break;
            }
        }
        res.render("removequestion",{
            topicData: topicArray[i], 
            i: 1
        });
    }
    else{
        res.redirect("/login");
    } 
})

app.post("/deletequestion", async (req, res) => {
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        const topicname = req.body.rqi;
        const qname = req.body.qname;
        const topicArray = curUser.data;
        for(i = 0; i < topicArray.length; i++){
            if(topicArray[i].topicname === req.body.rqi){
                break;
            }
        }
        const questionArray = topicArray[i].content;
        for(j = 0; j < questionArray.length; j++){
            if(questionArray[j].qname === qname){
                break;
            }
        }
        questionArray.splice(j, 1);
        curUser.save();
        res.redirect("/topicwiselist/"+topicname);
    }
    else{
        res.redirect("/login");
    }
})


//-------------------------------------------------



app.listen(3000, ()=>{
    console.log("listening.......");
});