#!/usr/bin/env node
console.log("djdata.js start")

var fs        = require("fs");
var libdtrace = require("libdtrace");
var midi      = require("midi");
var mm        = require("musicmetadata");
var path      = require("path");

var dSrc      = 'syscall::open*:entry /execname == "Traktor"/ { @[copyinstr(arg0)] = count(); }'
var fileExts  = [".mp3", ".wav", ".aiff", ".flac", ".ogg", ".wma", ".aac"]
var portName  = "djdata.js"

// variables for tracking global state
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
    files.unshift(key[0])
    files.length = 100
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

    // wait 500ms for dtrace consumer to sychnonize,
    // then assume most recent open was the loaded track
    setTimeout(function() {
      for (var i = 0; i < files.length; i++) {
        var file = files[i]
        if (fileExts.indexOf(path.extname(file)) == -1) continue;

        var parser = mm(fs.createReadStream(file));
        parser.on("metadata", function (result) {
          console.log(result);
        });

        break;
      }
    }, 1000)
  }
});

console.log("midi input open name=" + portName);
input.openVirtualPort(portName);

//input.closePort();
