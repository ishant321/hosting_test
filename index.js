// ---------- INDEX ----------

// 1. ALL IMPORTS
// 2. MIDDLEWARES

//---------------------------


//-------------------- ALL IMPORTS ------------------------
var express = require("express");
var bodyParser = require("body-parser");
const mongoose = require("mongoose");
var _ = require("lodash");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findorcreate = require("mongoose-findorcreate");
const session = require("express-session");
const flash = require("connect-flash");
require("dotenv").config();
//---------------------------------------------------------





//----------------- MIDDLEWARES ----------------------------
var app = express();
app.locals._ = _;

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"));
app.use(express.static("images"));
app.use(flash());

app.use(session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());
//-----------------------------------------------------------





//------------- DATABASE CONNECTIONS ------------------------
mongoose.connect("mongodb+srv://ishant:mongodbatlas@cluster0.qho5cx4.mongodb.net/dsauserDB").then(() => console.log("Connected!"));

const topicSchema = new mongoose.Schema({
    topicname: String,
    content: [{ qname: String, link: String } ]
});
const topicModel = mongoose.model("topicModel", topicSchema);

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    data: [topicSchema]
});

userSchema.plugin(passportLocalMongoose, {usernameField: "email"});
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






//------------------ AUTHENTICATION ------------------------

app.get("/auth/local", (req, res) => {
    res.render("auth/login", {message: ""});
});

app.get("/register", (req, res) => {
    res.render("commonhome", {
        text: ""
    });
})

app.post("/register",  (req, res)=>{
    const name = _.lowerCase(req.body.name);
    userModel.register({ email: req.body.email, name: name}, req.body.password, async (err, user)=>{
      if(err){
        console.log(err);
        res.redirect("/register");
      } 
      else{
        passport.authenticate("local", {failureRedirect: "/"})(req, res, () => {
            res.redirect("/userhome");
        })
      }
    })
})

app.get("/login", (req, res) => {
    res.render("auth/login", { message: req.flash("info")});
});

app.post("/login", async (req, res) => {
    const user = new userModel({
        email: req.body.email,
        password: req.body.password
    })
    req.login(user, async function(err) {
        if (err) { 
            console.log(err);
            res.redirect("/login");
        }else{
            const curUser = await userModel.findOne({email: user.email});
            if(!curUser){
                req.flash("info", "Email not registered");
                res.render("auth/login", {message: req.flash("info")});
            }
            else{
                passport.authenticate("local", {failureFlash: req.flash("info", "Invalid username or password"), failureRedirect: "/login"})(req, res, ()=>{
                    res.redirect("/userhome");
                });
            }
        }
    });
});

app.get("/resetpassword", (req, res) => {
    res.render("auth/resetpassword",{
        message: req.flash("info")
    });
});

app.post("/reset", async (req,res) => {
    const curUsername = req.body.username;
    const pass = req.body.password;
    const cPass = req.body.confirmpassword;
    const curUser = await userModel.findOne({email: curUsername}).exec();
    if(curUser){
        if(cPass != pass){
            res.render("auth/resetpassword",{
                message: "password doesnot match"
            })
        }
        else{
            curUser.setPassword(req.body.newpassword,(err, u) => {
                if (err){
                    console.log(err);
                }
                curUser.save();
                req.flash("info", "Reset done.");
                res.redirect("/login");  
            });
            }
    }
    else{
        req.flash("info", "email not registered")
        res.render("auth/resetpassword", {message: req.flash("info")});
    }
});

app.post("/changepassword", async (req, res) => {
    if(req.isAuthenticated()){
            res.render("auth/changepassword", { message: req.flash("info") });
    }
    else{
        res.redirect("/login");
    }
});

app.post("/change", async (req, res) => {
    if(req.isAuthenticated()){
        await userModel.findById(req.user.id)
        .then((u) => {
            const curEmail = req.body.username;
            if(u.email != curEmail){
                req.flash("info", "Enter correct email");
                res.render("auth/changepassword", {message: req.flash("info")})
            }else{
            u.setPassword(req.body.newpassword,(err, u) => {
                if (err){
                    console.log(err);
                }
                u.save();
                req.flash("info", "password changed successfully");
                res.redirect("/userhome");  
            });
            }
        })
    }
    else{
        res.redirect("/login");
    }
})

app.post("/logout", (req, res) => {
    req.logout(function(err) {
        if (err) { 
            console.log(err);
         }
        res.redirect("/");
    });
})

//---------------------------------------------------------





//----------------- HOME ROUTES ---------------------------
// app.get("/", async (req, res)=>{
//     if(req.isAuthenticated()){
//         res.redirect("/userhome");
//     }
//     else{
//         res.render("commonhome",{
//             text: "",
//             message: req.flash("info")
//         });
//     }
// });

app.get("/", (req, res) => {
    res.render("commonhome");
})

app.get("/userhome", async (req, res)=>{
    if(req.isAuthenticated()){
        const curUser = await userModel.findById(req.user.id).exec();
        res.render("userhome", {
            nameOfUser: curUser.name,
            topics: curUser.data,
            message: req.flash("info")
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
        // console.log(list);
        var x = req.params.list;
        x.trim();
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