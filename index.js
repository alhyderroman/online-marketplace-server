const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 9000;

const app = express();

//middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174","https://online-marketplace-9cf54.web.app"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

//verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log(err);
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
  console.log(token);
};
// const uri='mongodb://localhost:27017';
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kxgqdcj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const jobsCollection = client.db("marketplace").collection("jobs");
    const bidsCollection = client.db("marketplace").collection("bids");

    //jwt generate // created cookie and sent to server side
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      // res.send({token}) /* এভাবে সেন্ড করলে ক্লায়েন্টের ডাটার মধ্যে টোকেন কে পাবে*/
      res
        .cookie("token", token, {
          /* ব্রাউজারের এপ্লিপেকশনের কুকিজে ডাটা পাঠাতে হলে নেম এন্ড ভ্যালু এভাবে দু্টি প্যারামিটার তারপর  একটি অবজেক্ট*/
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", //true if only in case of vercel or productin
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear token on logout
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    //Get all jobs data from db
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    //Get a single job data using job id for job details page
    app.get("/jobDetail/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    //get job data for update
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });
    //get data for update job
    // app.put('/job/:id',async(req,res)=>{
    //   const id=req.params.id;
    //   const jobData=req.body;
    //   const query={_id:new ObjectId(id)}
    //   const options={upsert:true}
    //   const updateDoc={
    //     $set:{
    //       ...jobData,
    //     },
    //   }
    //   const result=await jobsCollection.updateOne(query,updateDoc,options)
    //   res.send(result);
    // })

    app.put("/job/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateJob = req.body;
      const update = {
        $set: {
          ...updateJob,
        },
      };
      const result = await jobsCollection.updateOne(filter, update, options);
      res.send(result);
    });
    //save a bid data in db
    app.post("/bid", async (req, res) => {
      const bidData = req.body;
      //check if it is a duplicate request
      const query={
        email:bidData.email,
        jobId:bidData.jobId
      }
      const alreadyApplied=await bidsCollection.findOne(query)
     if(alreadyApplied){
      return res.status(400).send('You have already placed a bid on this job')
     }
      
      const result = await bidsCollection.insertOne(bidData);
      res.send(result);
    });
    //save a job data in db
    app.post("/job", async (req, res) => {
      const jobData = req.body;
      const result = await jobsCollection.insertOne(jobData);
      res.send(result);
    });

    //get all jobs posted by a specific user
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      console.log(tokenEmail, "from token");
      const email = req.params.email;
      if (tokenEmail !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const query = { "buyer.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });
    //delete a job data from db
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    //get all bids  by a specific user
    app.get("/myBids/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    //get all bidrequests from various users  by a specific buyer or a job owner
    app.get("/bidRequests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { buyer_email: email };
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    });

    //update request status
    app.patch("/updateStatus/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: status,
      };
      const result = await bidsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

     //Get all jobs data from db for pagination
    app.get("/allJobs", async (req, res) => {
      const size=parseInt(req.query.size);
      const page=parseInt(req.query.page)-1;
      const filter=req.query.filter;
      const sort=req.query.sort;
      const search=req.query.search;
      console.log(size,page);
      let query={
        job_title:{$regex:search,$options:'i'}
      }
      if(filter) query.category=filter //or query={...query,category:filter}
       let options={}
      if(sort) options={sort:{deadline:sort==='asc'?1:-1}}
      const result = await jobsCollection.find(query,options).skip(page*size).limit(size).toArray();
      res.send(result);
    });
  //Get all jobs data count from db
  app.get("/jobsCount", async (req, res) => {
    const filter=req.query.filter;
    const search=req.query.search;
      let query={
        job_title:{$regex:search,$options:'i'}
      }
      if(filter) query.category=filter //query={...query,category:filter}
     
    const count = await jobsCollection.countDocuments(query)
    res.send({count});
  });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("market place server is running");
});

app.listen(port, () => {
  console.log(`marketplace server is running on port ${port}`);
});
