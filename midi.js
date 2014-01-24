#!/usr/bin/env node
console.log("djdata.js start")

var events    = require("events");
var emitter   = new events.EventEmitter();
var fs        = require("fs");
var libdtrace = require("libdtrace");
var midi      = require("midi");
var mm        = require("musicmetadata");
var path      = require("path");

var dSrc      = 'syscall::open*:entry /execname == "Traktor"/ { @[copyinstr(arg0)] = max(walltimestamp); }'
var fileExts  = [".mp3", ".wav", ".aiff", ".flac", ".ogg", ".wma", ".aac"]
var portName  = "djdata.js"

// variables for tracking global state
var loadMessages = [];
var decks = {};
var files = [];

// Set up a new dtrace consumer
var dtp = new libdtrace.Consumer();
dtp.strcompile(dSrc);
dtp.go();
console.log("dtrace probe go");

// every 100ms consume dtrace into shared files buffer
setInterval(function () {
  dtp.aggwalk(function (id, key, val) {
    if (fileExts.indexOf(path.extname(key[0])) == -1) return;
    if (loadMessages.length > 0) {
      emitter.emit("openAudioFile", key[0], val, loadMessages)
      loadMessages = []
    }
  });
}, 100);

// Set up a new midi input
var input = new midi.input();
input.on("message", function(deltaTime, message) {
  message["ts"] = Date.now() // track wall time of message
  var channel = message[0]
  var cc      = message[1]
  var value   = message[2]

  console.log("midi input on message channel=" + channel + " cc=" + ("000" + cc).slice(-3) + " value=" + ("000" + value).slice(-3) + " ts=" + message.ts)

  if (channel == 176 && value==127) { // "Deck is Loaded" channel
    // push message to a global synchronization queue and wait for an event
    loadMessages.push(message)
    emitter.removeAllListeners("openAudioFile")
    emitter.once("openAudioFile", function(p, ts, messages) {
      // check that midi message occurred very near or after open timestamp
      var d = ts / 1000000 - message.ts
      if (d > 200) {
        console.log("track ignored path=" + p + " delta=" + d )
        return false;
      }

      var parser = mm(fs.createReadStream(p));
      parser.on("metadata", function (result) {
        decks[cc] = { "artist": result.artist, "title": result.title, "load_at": Date.now() }
        console.log("track loaded assignment=" + cc + " artist=" + result.artist + " title=" + result.title  + " delta=" + d)
      });
    });
  }
});

console.log("midi input open name=" + portName);
input.openVirtualPort(portName);

//input.closePort();
