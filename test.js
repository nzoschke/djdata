#!/usr/bin/env node
console.log("test.js start")

var assert = require("assert")

function Session() {
  this.db = []
  this.decks = {
    0: { "artist": null, "title": null, "load": null, "unload": null, "cue_in": null, "cue_out": null, "fade_in": null, "fade_out": null },
    1: { "artist": null, "title": null, "load": null, "unload": null, "cue_in": null, "cue_out": null, "fade_in": null, "fade_out": null },
    2: { "artist": null, "title": null, "load": null, "unload": null, "cue_in": null, "cue_out": null, "fade_in": null, "fade_out": null },
    3: { "artist": null, "title": null, "load": null, "unload": null, "cue_in": null, "cue_out": null, "fade_in": null, "fade_out": null }
  }

  this.selectLatest = function(deck_id) {
    for (var i = this.db.length-1; i >= 0; i--) {
      var data = this.db[i]
      if (data.deck_id == deck_id)
        return { "idx": i, "data": data }
    }

    var data = {
      "deck_id":  deck_id,
      "artist":   null, "title":    null, 
      "load":     null, "unload":   null, 
      "play_in":  null, "play_out": null, 
      "cue_in":   null, "cue_out":  null, 
      "fade_in":  null, "fade_out": null 
    }
    return { "idx": null, "data": data }
  }

  this.selectLoaded = function(deck_id) {
    var row = this.selectLatest(deck_id)
    if (row.data.load && !row.data.unload)
      return row
    return null
  }

  this.appendLoadEvent = function(deck_id, event, metadata) {
    var row = this.selectLoaded(deck_id)
    if (row) {
      this.db[row.idx].unload = Date.now()
    }

    var data = this.selectLatest(-1).data
    data.deck_id  = deck_id
    data.artist   = metadata.artist
    data.title    = metadata.title
    data.load     = event.ts || Date.now()

    this.db.push(data)
  }

  this.appendPlayEvent = function(deck_id, event) {
    var row = this.selectLoaded(deck_id)
    if (!row) return

    // TODO: add advanced multi-event logic. Either save all in and out 
    // events, save most significant pair, etc.
    p = event.value == 127 ? "play_in" : "play_out"
    this.db[row.idx][p] = event.ts || Date.now()
  }

  this.appendCueEvent = function(deck_id, event) {
    var row = this.selectLoaded(deck_id)
    if (!row) return

    // TODO: multi-event logic
    p = event.value == 127 ? "cue_in" : "cue_out"
    this.db[row.idx][p] = event.ts || Date.now()
  }

  this.appendFadeEvent = function(deck_id, event) {
    var row = this.selectLoaded(deck_id)
    if (!row) return


    p = event.value == 127 ? "cue_in" : "cue_out"
    this.db[row.idx][p] = event.ts || Date.now()
  }

  this.update = function(deck_id, event, metadata) {

  }

  // close any saved events that are dangling
}

var s = new Session();

// Test "database" primative query
row = s.selectLatest(0);
assert.equal(row.idx, null)
assert.deepEqual(row.data, {
  "deck_id":  0,
  "artist":   null, "title":    null, 
  "load":     null, "unload":   null, 
  "play_in":  null, "play_out": null, 
  "cue_in":   null, "cue_out":  null, 
  "fade_in":  null, "fade_out": null 
})

// Test database primative append by loading a track
s.appendLoadEvent(0, { "ts": 1390496500000 }, { "artist": "Radiohead", "title": "Jigsaw Falling Into Place" })
row = s.selectLatest(0);
assert.equal(row.idx, 0)
assert.deepEqual(row.data, {
  "deck_id":  0,
  "artist":   "Radiohead",
  "title":    "Jigsaw Falling Into Place", 
  "load":     1390496500000,

  "unload": null, "play_in": null, "play_out": null, "cue_in": null, "cue_out": null,  "fade_in": null, "fade_out": null 
})

// Test cue in/out update on loaded track
s.appendCueEvent(0, { "value": 127, "ts": 1390496500000 })
assert.equal(s.selectLatest(0).data.cue_in, 1390496500000)
s.appendCueEvent(0, { "value": 0, "ts": 1390496500001 })
assert.equal(s.selectLatest(0).data.cue_out, 1390496500001)


// Test play in/out update on loaded track
s.appendPlayEvent(0, { "value": 127, "ts": 1390496500010 })
assert.equal(s.selectLatest(0).data.play_in, 1390496500010)
s.appendPlayEvent(0, { "value": 0, "ts": 1390496500020 })
assert.equal(s.selectLatest(0).data.play_out, 1390496500020)

// Test fade in/out update on loaded track

// TODO: Test inheriting control state from last track