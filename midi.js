#!/usr/bin/env node
console.log("midi.js start")

var libdtrace   = require('libdtrace');
var midi        = require('midi');
var path        = require("path");

var portName  = "traktor.js"
var audioExts = [".mp3", ".wav", ".aiff", ".flac", ".ogg", ".wma", ".aac"]

var times   = [];
var events  = {};

// Set up a new midi input
var input = new midi.input();
input.on('message', function(deltaTime, message) {
  console.log("midi input on message=" + message + " d=" + deltaTime)
});

console.log("midi input open name=" + portName);
input.openVirtualPort(portName);

// Set up a new dtrace consumer
var dtp = new libdtrace.Consumer();
var prog = 'syscall::open*:entry /execname == "Traktor"/ { @[copyinstr(arg0)] = count(); }'
dtp.strcompile(prog);

console.log("dtrace probe go");
dtp.go();

setInterval(function () {
  dtp.aggwalk(function (id, key, val) {
    // noop unless extension is in audioExts
    if (audioExts.indexOf(path.extname(key)) == -1) return;
    console.log(id, key, val)
  });
}, 1000);

//input.closePort();
