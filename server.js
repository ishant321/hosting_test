var express = require("express");
var bodyParser = require("body-parser");
const mongoose = require('mongoose');
var _ = require('lodash');
const notifier = require('node-notifier');

var app = express();
app.locals._ = _;

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"));


mongoose.connect('mongodb+srv://ishant:mongodbatlas@cluster0.qho5cx4.mongodb.net/dsaDB').then(() => console.log('Connected!'));
const dsaSchema = new mongoose.Schema({
    name: String,
    content: [{
        qname: String,
        link: String
    }
    ]
});
const dsaModel = new mongoose.model("dsamodel", dsaSchema);

app.get("/", async (req, res)=>{
    const t = await dsaModel.find().exec();
    res.render("home",{
        t: t
    }); 
});

app.get("/addtopic",(req, res)=>{
    res.render("addtopic");
});

app.get("/tohome", (req, res)=>{
    res.redirect("/");
})


app.post("/addnewtopic", async (req, res) => {
    var modelName = _.lowerCase(req.body.topicName);
    var nm = await dsaModel.findOne({name: modelName});
    if(nm == null){
        await dsaModel.insertMany([{name: modelName}]);
    }
    res.redirect("/");
});

app.get("/removetopic", async (req, res)=>{
    const t = await dsaModel.find().exec();
    if(t.length == 0){
        res.redirect("/");
    }
    res.render("removetopic",{
        t: t
    });
});

app.post("/remove", async (req, res) => {
    const k = req.body.rembtn;
    notifier.notify("Do you want to delete?");
    await dsaModel.deleteOne({name: k}).exec();
    res.redirect("/");
});

app.get("/topicwiselist/:list", async (req, res) => {
    const tname = await dsaModel.findOne({name: req.params.list}).exec();
    res.render("topicwiselist",{
        topicname: tname,
        content: tname.content,
        i: 1
    })
})

//---------QUESTION ADDITION AND REMOVAL ----------


app.get("/addquestion", (req, res) => {
    console.log(req.body.aq);
    res.render("addquestion");
})

app.post("/addquestion", (req, res) => {
    res.render("addquestion", {
        topicname: req.body.addq
    })
})

app.post("/newquestion", async (req, res) => {
    const topicName = req.body.nqb;
    const questionName = req.body.questionName;
    const questionLink = req.body.questionLink;

    const curTopic = await dsaModel.findOne({name: topicName}).exec();
    const temp = curTopic.content;
    let l = Number(temp.length);
    const temp2 = l+1;

    await dsaModel.updateOne({name: topicName}, {$push: {content: {"sno": temp2, "qname": questionName, "link": questionLink}}});

    res.redirect("/topicwiselist/"+topicName);
})

//---------------QUESTION REMOVAL--------------

app.post("/removequestion", async (req, res) => {
    const topicName = await dsaModel.findOne({name: req.body.removeq}).exec();
    res.render("removequestion",{
        topicName: topicName, 
        i: 1
    });
})

app.post("/deletequestion", async (req, res) => {
    const tname = req.body.tname;
    const qname = req.body.qname;

    await dsaModel.updateOne({name: tname}, {$pull: {content: {qname: qname}}});
    res.redirect("/topicwiselist/"+tname);
})


//-------------------------------------------------



app.listen(3000, ()=>{
    console.log("listening.......");
});