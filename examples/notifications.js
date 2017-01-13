"use strict";

var Client = require("./../dist/index.js");
var testAuth = require("./../testAuth.json");
console.log(Client);

var github = new Client({
  debug: true
});

github.authenticate({
  type: "oauth",
  token: testAuth["token"]
});

// github.activity.markNotificationsAsRead({
// }, function(err, res) {
//     console.log(err, res);
// });

github.activity.markNotificationsAsReadForRepo({
  owner: "facebook",
  repo: "react",
  last_read_at: "2017-01-12T00:00:13Z"
}, function (err, res) {
  console.log(err, res);
});
