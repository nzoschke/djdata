#!/usr/bin/env node
console.log("djdata.js start")

var events    = require("events");
var emitter   = new events.EventEmitter();
var fs        = require("fs");
var libdtrace = require("libdtrace");
var midi      = require("midi");
var mm        = require("musicmetadata");
var path      = require("path");

var dSrc      = 'syscall::open*:entry /execname == "Traktor"/ { @[copyinstr(arg0)] = max(timestamp); }'
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
    console.log(id, key, val)
    if (loadMessages.length > 0) {
      emitter.emit("openAudioFile", key[0], loadMessages)
      loadMessages = []
    }
  });
}, 100);

// Set up a new midi input
var input = new midi.input();
input.on("message", function(deltaTime, message) {
  var channel = message[0]
  var cc      = message[1]
  var value   = message[2]

  console.log("midi input on message=" + message + " channel=" + channel + " cc=" + cc + " value=" + value)

  if (channel == 176 && value==127) { // "Deck is Loaded" channel
    console.log("track loaded assignment=" + cc)

    // push the message to a global queue and wait for dtrace consumer loop to callback
    loadMessages.push(message)
    emitter.removeAllListeners("openAudioFile")
    emitter.once("openAudioFile", function(p, messages) {
      console.log(p, messages)

      var parser = mm(fs.createReadStream(p));
      parser.on("metadata", function (result) {
        decks[cc] = { "artist": result.artist, "title": result.title, "load_at": Date.now() }
      });
    });
  }
});

console.log("midi input open name=" + portName);
input.openVirtualPort(portName);

//input.closePort();
