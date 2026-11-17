const express = require("express");
const webpush = require("web-push");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname,"data");
const DB_FILE = path.join(DATA_DIR,"subscriptions.json");
fs.mkdirSync(DATA_DIR,{recursive:true});
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject,vapidPublicKey,vapidPrivateKey);
}

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); }
  catch { return {devices:{}}; }
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));
}
function subKey(subscription) {
  return subscription?.endpoint;
}
app.get("/api/health",(req,res)=>res.json({ok:true}));
app.get("/api/public-config",(req,res)=>res.json({vapidPublicKey}));
app.post("/api/subscribe",(req,res)=>{
  if (!vapidPublicKey || !vapidPrivateKey) return res.status(503).json({error:"Push is not configured"});
  const subscription = req.body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
    return res.status(400).json({error:"Invalid push subscription"});
  const db = readDB();
  const key = subKey(subscription);
  db.devices[key] = db.devices[key] || {subscription,schedules:[]};
  db.devices[key].subscription = subscription;
  writeDB(db);
  res.json({ok:true});
});
app.post("/api/schedules",(req,res)=>{
  const subscription = req.body?.subscription;
  const schedules = req.body?.schedules;
  if (!subscription?.endpoint || !Array.isArray(schedules)) return res.status(400).json({error:"Invalid request"});
  const db = readDB();
  const device = db.devices[subKey(subscription)];
  if (!device) return res.status(404).json({error:"Enable notifications on this device first"});
  device.schedules = schedules.filter(s =>
    s && typeof s.id==="string" && typeof s.name==="string" &&
    Number.isFinite(s.startAt) && Number.isFinite(s.intervalHours) &&
    s.intervalHours>0 && s.intervalHours<=24 &&
    Number.isInteger(s.durationDays) && s.durationDays>0 && s.durationDays<=365
  ).map(s=>({
    id:s.id,name:s.name.slice(0,70),startAt:s.startAt,
    intervalHours:s.intervalHours,durationDays:s.durationDays,lastSentDue:0
  }));
  writeDB(db);
  res.json({ok:true,count:device.schedules.length});
});

// Check schedules every 30 seconds. Push notifications are sent by this server,
// not by a timer running in the phone browser.
async function checkDueReminders() {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  const db = readDB();
  const now = Date.now();
  let changed = false;
  for (const [endpoint,device] of Object.entries(db.devices)) {
    for (const schedule of device.schedules || []) {
      const endAt = schedule.startAt + schedule.durationDays*86400000;
      if (now < schedule.startAt || now >= endAt) continue;
      const step = schedule.intervalHours*3600000;
      const due = schedule.startAt + Math.floor((now-schedule.startAt)/step)*step;
      // Send once for a due time; allow a short catch-up window after server restart.
      if (due <= schedule.lastSentDue || now-due > 10*60*1000) continue;
      try {
        await webpush.sendNotification(device.subscription,JSON.stringify({
          title:"💧 Eye Drops Reminder",
          body:`Reminder for ${schedule.name}. Check your prescribed instructions.`,
          tag:`drop-${schedule.id}-${due}`,
          url:"/"
        }),{TTL:3600});
        schedule.lastSentDue = due;
        changed = true;
      } catch (err) {
        if (err.statusCode===404 || err.statusCode===410) {
          delete db.devices[endpoint];
          changed = true;
          break;
        }
        console.error("Push send failed:",err.message);
      }
    }
  }
  if (changed) writeDB(db);
}
setInterval(checkDueReminders,30000);
checkDueReminders();

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Eye Drops PWA listening on ${PORT}`));
