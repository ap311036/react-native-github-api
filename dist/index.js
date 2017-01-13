(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/** section: github
 * class HttpError
 *
 *  Copyright 2012 Cloud9 IDE, Inc.
 *
 *  This product includes software developed by
 *  Cloud9 IDE, Inc (http://c9.io).
 *
 *  Author: Mike de Boer <mike@c9.io>
 **/

var Util = require("util");

exports.HttpError = function(message, code, headers) {
    Error.call(this, message);
    //Error.captureStackTrace(this, arguments.callee);
    this.message = message;
    this.code = code;
    this.status = statusCodes[code];
    this.headers = headers;
};
Util.inherits(exports.HttpError, Error);

(function() {
    /**
     *  HttpError#toString() -> String
     *
     *  Returns the stringified version of the error (i.e. the message).
     **/
    this.toString = function() {
        return this.message;
    };

    /**
     *  HttpError#toJSON() -> Object
     *
     *  Returns a JSON object representation of the error.
     **/
    this.toJSON = function() {
        return {
            code: this.code,
            status: this.status,
            message: this.message
        };
    };

}).call(exports.HttpError.prototype);


var statusCodes = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request-URI Too Long",
    415: "Unsupported Media Type",
    416: "Requested Range Not Satisfiable",
    417: "Expectation Failed",
    420: "Enhance Your Calm",
    422: "Unprocessable Entity",
    423: "Locked",
    424: "Failed Dependency",
    425: "Unordered Collection",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    444: "No Response",
    449: "Retry With",
    499: "Client Closed Request",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    509: "Bandwidth Limit Exceeded",
    510: "Not Extended",
    511: "Network Authentication Required"
};

// XXX: Remove?
for (var status in statusCodes) {
    var defaultMsg = statusCodes[status];

    var error = (function(defaultMsg, status) {
        return function(msg) {
            this.defaultMessage = defaultMsg;
            exports.HttpError.call(this, msg || status + ": " + defaultMsg, status);

            if (status >= 500)
                Error.captureStackTrace(this, arguments.callee);
        };
    })(defaultMsg, status);

    Util.inherits(error, exports.HttpError);

    var className = toCamelCase(defaultMsg);
    exports[className] = error;
    exports[status] = error;
}

function toCamelCase(str) {
    return str.toLowerCase().replace(/(?:(^.)|(\s+.))/g, function(match) {
        return match.charAt(match.length-1).toUpperCase();
    });
}

},{"util":22}],2:[function(require,module,exports){
(function (process){
"use strict";

var Url = require("url");
var error = require("./error");
var mime = require("mime-types");
var Util = require("./util");
var Promise = require("./promise");
var Buffer = require('buffer/').Buffer;

var isNode = process.title === 'node';

/** section: github
 * class Client
 *
 *  Copyright 2012 Cloud9 IDE, Inc.
 *
 *  This product includes software developed by
 *  Cloud9 IDE, Inc (http://c9.io).
 *
 *  Author: Mike de Boer <mike@c9.io>
 *
 *  Upon instantiation of the [[Client]] class, the routes.json file is loaded
 *  and parsed for the API HTTP endpoints. For each HTTP endpoint to the
 *  HTTP server, a method is generated which accepts a Javascript Object
 *  with parameters and an optional callback to be invoked when the API request
 *  returns from the server or when the parameters could not be validated.
 *
 *  When an HTTP endpoint is processed and a method is generated as described
 *  above, [[Client]] also sets up parameter validation with the rules as
 *  defined in the routes.json.
 *
 *  These definitions are parsed and methods are created that the client can call
 *  to make an HTTP request to the server.
 *
 *  For example, the endpoint `gists/get-from-user` will be exposed as a member
 *  on the [[Client]] object and may be invoked with
 *
 *      client.getFromUser({
 *          "user": "bob"
 *      }, function(err, ret) {
 *          // do something with the result here.
 *      });
 *
 *      // or to fetch a specfic page:
 *      client.getFromUser({
 *          "user": "bob",
 *          "page": 2,
 *          "per_page": 100
 *      }, function(err, ret) {
 *          // do something with the result here.
 *      });
 *
 *  All the parameters as specified in the Object that is passed to the function
 *  as first argument, will be validated according to the rules in the `params`
 *  block of the route definition.
 *  Thus, in the case of the `user` parameter, according to the definition in
 *  the `params` block, it's a variable that first needs to be looked up in the
 *  `params` block of the `defines` section (at the top of the JSON file). Params
 *  that start with a `$` sign will be substituted with the param with the same
 *  name from the `defines/params` section.
 *  There we see that it is a required parameter (needs to hold a value). In other
 *  words, if the validation requirements are not met, an HTTP error is passed as
 *  first argument of the callback.
 *
 *  Implementation Notes: the `method` is NOT case sensitive, whereas `url` is.
 *  The `url` parameter also supports denoting parameters inside it as follows:
 *
 *      "get-from-user": {
 *          "url": "/users/:owner/gists",
 *          "method": "GET"
 *          ...
 *      }
 **/
var Client = module.exports = function (config) {
  if (!(this instanceof Client)) {
    return new Client(config);
  }

  config = config || {}
  config.headers = config.headers || {};
  this.config = config;
  this.debug = Util.isTrue(config.debug);
  this.Promise = config.Promise || config.promise || Promise;

  this.routes = require("./routes.json");

  var pathPrefix = "";
  // Check if a prefix is passed in the config and strip any leading or trailing slashes from it.
  if (typeof config.pathPrefix == "string") {
    pathPrefix = "/" + config.pathPrefix.replace(/(^[\/]+|[\/]+$)/g, "");
    this.config.pathPrefix = pathPrefix;
  }

  // store mapping of accept header to preview api endpoints
  var mediaHash = this.routes.defines.acceptTree;
  var mediaTypes = {};

  for (var accept in mediaHash) {
    for (var route in mediaHash[accept]) {
      mediaTypes[mediaHash[accept][route]] = accept;
    }
  }

  this.acceptUrls = mediaTypes;

  this.setupRoutes();
};

(function () {
  /**
   *  Client#setupRoutes() -> null
   *
   *  Configures the routes as defined in routes.json.
   *
   *  [[Client#setupRoutes]] is invoked by the constructor, takes the
   *  contents of the JSON document that contains the definitions of all the
   *  available API routes and iterates over them.
   *
   *  It first recurses through each definition block until it reaches an API
   *  endpoint. It knows that an endpoint is found when the `url` and `param`
   *  definitions are found as a direct member of a definition block.
   *  Then the availability of an implementation by the API is checked; if it's
   *  not present, this means that a portion of the API as defined in the routes.json
   *  file is not implemented properly, thus an exception is thrown.
   *  After this check, a method is attached to the [[Client]] instance
   *  and becomes available for use. Inside this method, the parameter validation
   *  and typecasting is done, according to the definition of the parameters in
   *  the `params` block, upon invocation.
   *
   *  This mechanism ensures that the handlers ALWAYS receive normalized data
   *  that is of the correct format and type. JSON parameters are parsed, Strings
   *  are trimmed, Numbers and Floats are casted and checked for NaN after that.
   *
   *  Note: Query escaping for usage with SQL products is something that can be
   *  implemented additionally by adding an additional parameter type.
   **/
  this.setupRoutes = function () {
    var self = this;
    var routes = this.routes;
    var defines = routes.defines;
    this.constants = defines.constants;
    this.requestHeaders = defines["request-headers"].map(function (header) {
      return header.toLowerCase();
    });
    this.responseHeaders = defines["response-headers"].map(function (header) {
      return header.toLowerCase();
    });
    delete routes.defines;

    function trim(s) {
      if (typeof s != "string") {
        return s;
      }
      return s.replace(/^[\s\t\r\n]+/, "").replace(/[\s\t\r\n]+$/, "");
    }

    function parseParams(msg, paramsStruct) {
      var params = Object.keys(paramsStruct);
      var paramName, def, value, type;
      for (var i = 0, l = params.length; i < l; ++i) {
        paramName = params[i];
        if (paramName.charAt(0) == "$") {
          paramName = paramName.substr(1);
          if (!defines.params[paramName]) {
            throw new error.BadRequest("Invalid variable parameter name substitution; param '" +
              paramName + "' not found in defines block", "fatal");
          } else {
            def = paramsStruct[paramName] = defines.params[paramName];
            delete paramsStruct["$" + paramName];
          }
        } else {
          def = paramsStruct[paramName];
        }

        value = msg[paramName];
        if (typeof value != "boolean" && !value) {
          // we don't need validation for undefined parameter values
          // that are not required.
          if (!def.required ||
            (def["allow-empty"] && value === "") ||
            (def["allow-null"] && value === null)) {
            continue;
          }
          throw new error.BadRequest("Empty value for parameter '" +
            paramName + "': " + value);
        }

        // validate the value and type of parameter:
        if (def.validation) {
          if (!new RegExp(def.validation).test(value)) {
            throw new error.BadRequest("Invalid value for parameter '" +
              paramName + "': " + value);
          }
        }

        if (def.type) {
          type = def.type.toLowerCase();
          if (type == "number") {
            value = parseInt(value, 10);
            if (isNaN(value)) {
              throw new error.BadRequest("Invalid value for parameter '" +
                paramName + "': " + msg[paramName] + " is NaN");
            }
          } else if (type == "float") {
            value = parseFloat(value);
            if (isNaN(value)) {
              throw new error.BadRequest("Invalid value for parameter '" +
                paramName + "': " + msg[paramName] + " is NaN");
            }
          } else if (type == "json") {
            if (typeof value == "string") {
              try {
                value = JSON.parse(value);
              } catch (ex) {
                throw new error.BadRequest("JSON parse error of value for parameter '" +
                  paramName + "': " + value);
              }
            }
          } else if (type == "date") {
            value = new Date(value);
          }
        }
        msg[paramName] = value;
      }
    }

    function prepareApi(struct, baseType) {
      if (!baseType) {
        baseType = "";
      }
      Object.keys(struct).forEach(function (routePart) {
        var block = struct[routePart];
        if (!block) {
          return;
        }
        var messageType = baseType + "/" + routePart;
        if (block.url && block.params) {
          // we ended up at an API definition part!
          var endPoint = messageType.replace(/^[\/]+/g, "");
          var parts = messageType.split("/");
          var section = Util.toCamelCase(parts[1].toLowerCase());
          parts.splice(0, 2);
          var funcName = Util.toCamelCase(parts.join("-"));

          if (!self[section]) {
            self[section] = {};
            // add a utility function 'getFooApi()', which returns the
            // section to which functions are attached.
            self[Util.toCamelCase("get-" + section + "-api")] = function () {
              return self[section];
            };
          }

          self[section][funcName] = function (msg, callback) {
            try {
              parseParams(msg, block.params);
            } catch (ex) {
              // when the message was sent to the client, we can
              // reply with the error directly.
              self.sendError(ex, block, msg, callback);
              if (self.debug) {
                Util.log(ex.message, "fatal");
              }

              if (self.Promise && typeof callback !== 'function') {
                return self.Promise.reject(ex)
              }

              // on error, there's no need to continue.
              return;
            }

            if (!callback) {
              if (self.Promise) {
                return new self.Promise(function (resolve, reject) {
                  var cb = function (err, obj) {
                    if (err) {
                      reject(err);
                    } else {
                      resolve(obj);
                    }
                  };
                  self.handler(msg, JSON.parse(JSON.stringify(block)), cb);
                });
              } else {
                throw new Error('neither a callback or global promise implementation was provided');
              }
            } else {
              self.handler(msg, JSON.parse(JSON.stringify(block)), callback);
            }
          };
        } else {
          // recurse into this block next:
          prepareApi(block, messageType);
        }
      });
    }

    prepareApi(routes);
  };

  /**
   *  Client#authenticate(options) -> null
   *      - options (Object): Object containing the authentication type and credentials
   *          - type (String): One of the following: `basic`, `oauth`, `token`, or `integration`
   *          - username (String): Github username
   *          - password (String): Password to your account
   *          - token (String): oauth/jwt token
   *
   *  Set an authentication method to have access to protected resources.
   *
   *  ##### Example
   *
   *      // basic
   *      github.authenticate({
     *          type: "basic",
     *          username: "mikedeboertest",
     *          password: "test1324"
     *      });
   *
   *      // oauth
   *      github.authenticate({
     *          type: "oauth",
     *          token: "e5a4a27487c26e571892846366de023349321a73"
     *      });
   *
   *      // oauth key/secret
   *      github.authenticate({
     *          type: "oauth",
     *          key: "clientID",
     *          secret: "clientSecret"
     *      });
   *
   *      // user token
   *      github.authenticate({
     *          type: "token",
     *          token: "userToken",
     *      });
   *
   *      // integration (jwt)
   *      github.authenticate({
     *          type: "integration",
     *          token: "jwt",
     *      });
   **/
  this.authenticate = function (options) {
    if (!options) {
      this.auth = false;
      return;
    }
    if (!options.type || "basic|oauth|client|token|integration".indexOf(options.type) === -1) {
      throw new Error("Invalid authentication type, must be 'basic', 'integration', 'oauth' or 'client'");
    }
    if (options.type == "basic" && (!options.username || !options.password)) {
      throw new Error("Basic authentication requires both a username and password to be set");
    }
    if (options.type == "oauth") {
      if (!options.token && !(options.key && options.secret)) {
        throw new Error("OAuth2 authentication requires a token or key & secret to be set");
      }
    }
    if ((options.type == "token" || options.type == "integration") && !options.token) {
      throw new Error("Token authentication requires a token to be set");
    }

    this.auth = options;
  };

  function getPageLinks(link) {
    if (typeof link == "object" && (link.link || link.meta.link)) {
      link = link.link || link.meta.link;
    }

    var links = {};
    if (typeof link != "string") {
      return links;
    }

    // link format:
    // '<https://api.github.com/users/aseemk/followers?page=2>; rel="next", <https://api.github.com/users/aseemk/followers?page=2>; rel="last"'
    link.replace(/<([^>]*)>;\s*rel="([\w]*)\"/g, function (m, uri, type) {
      links[type] = uri;
    });
    return links;
  }

  /**
   *  Client#hasNextPage(link) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *
   *  Check if a request result contains a link to the next page
   **/
  this.hasNextPage = function (link) {
    return getPageLinks(link).next;
  };

  /**
   *  Client#hasPreviousPage(link) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *
   *  Check if a request result contains a link to the previous page
   **/
  this.hasPreviousPage = function (link) {
    return getPageLinks(link).prev;
  };

  /**
   *  Client#hasLastPage(link) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *
   *  Check if a request result contains a link to the last page
   **/
  this.hasLastPage = function (link) {
    return getPageLinks(link).last;
  };

  /**
   *  Client#hasFirstPage(link) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *
   *  Check if a request result contains a link to the first page
   **/
  this.hasFirstPage = function (link) {
    return getPageLinks(link).first;
  };

  function getPage(link, which, headers, callback) {
    var self = this;
    var url = getPageLinks(link)[which];
    if (!url) {
      var urlErr = new error.NotFound("No " + which + " page found");
      return self.Promise && !callback ? self.Promise.reject(urlErr) : callback(urlErr);
    }

    var parsedUrl = Url.parse(url, true);

    var msg = Object.create(parsedUrl.query);
    if (headers != null) {
      msg.headers = headers;
    }

    var block = {
      url: parsedUrl.pathname,
      method: "GET",
      params: parsedUrl.query
    };

    if (!callback) {
      if (self.Promise) {
        return new self.Promise(function (resolve, reject) {
          var cb = function (err, obj) {
            if (err) {
              reject(err);
            } else {
              resolve(obj);
            }
          };
          self.handler(msg, JSON.parse(JSON.stringify(block)), cb);
        });
      } else {
        throw new Error('neither a callback or global promise implementation was provided');
      }
    } else {
      self.handler(msg, JSON.parse(JSON.stringify(block)), callback);
    }
  }

  /**
   *  Client#getNextPage(link, callback) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *      - headers (Object): Optional. Key/ value pair of request headers to pass along with the HTTP request.
   *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
   *
   *  Get the next page, based on the contents of the `Link` header
   **/
  this.getNextPage = function (link, headers, callback) {
    if (typeof headers == 'function') {
      callback = headers;
      headers = null;
    }
    return getPage.call(this, link, "next", headers, callback);
  };

  /**
   *  Client#getPreviousPage(link, callback) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *      - headers (Object): Optional. Key/ value pair of request headers to pass along with the HTTP request.
   *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
   *
   *  Get the previous page, based on the contents of the `Link` header
   **/
  this.getPreviousPage = function (link, headers, callback) {
    if (typeof headers == 'function') {
      callback = headers;
      headers = null;
    }
    return getPage.call(this, link, "prev", headers, callback);
  };

  /**
   *  Client#getLastPage(link, callback) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *      - headers (Object): Optional. Key/ value pair of request headers to pass along with the HTTP request.
   *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
   *
   *  Get the last page, based on the contents of the `Link` header
   **/
  this.getLastPage = function (link, headers, callback) {
    if (typeof headers == 'function') {
      callback = headers;
      headers = null;
    }
    return getPage.call(this, link, "last", headers, callback);
  };

  /**
   *  Client#getFirstPage(link, callback) -> null
   *      - link (mixed): response of a request or the contents of the Link header
   *      - headers (Object): Optional. Key/ value pair of request headers to pass along with the HTTP request.
   *      - callback (Function): function to call when the request is finished with an error as first argument and result data as second argument.
   *
   *  Get the first page, based on the contents of the `Link` header
   **/
  this.getFirstPage = function (link, headers, callback) {
    if (typeof headers == 'function') {
      callback = headers;
      headers = null;
    }
    return getPage.call(this, link, "first", headers, callback);
  };

  function getRequestFormat(hasBody, block) {
    if (hasBody) {
      return block.requestFormat || this.constants.requestFormat;
    }
    return "query";
  }

  function getQueryAndUrl(msg, def, format, config) {
    var url = def.url;
    if (config.pathPrefix && url.indexOf(config.pathPrefix) !== 0) {
      url = config.pathPrefix + def.url;
    }
    var ret = {
      query: format == "json" ? {} : format == "raw" ? msg.data : []
    };
    if (!def || !def.params) {
      ret.url = url;
      return ret;
    }

    Object.keys(def.params).forEach(function (paramName) {
      paramName = paramName.replace(/^[$]+/, "");
      if (!(paramName in msg)) {
        return;
      }

      var isUrlParam = url.indexOf(":" + paramName) !== -1;
      var valFormat = isUrlParam || format != "json" ? "query" : format;
      var val;
      if (valFormat != "json") {
        if (typeof msg[paramName] == "object") {
          try {
            msg[paramName] = JSON.stringify(msg[paramName]);
            val = encodeURIComponent(msg[paramName]);
          } catch (ex) {
            return Util.log("httpSend: Error while converting object to JSON: "
              + (ex.message || ex), "error");
          }
        } else if (def.params[paramName] && def.params[paramName].combined) {
          // Check if this is a combined (search) string.
          val = msg[paramName].split(/[\s\t\r\n]*\+[\s\t\r\n]*/)
                              .map(function (part) {
                                return encodeURIComponent(part);
                              })
                              .join("+");
        } else {
          // we don't want to encode ref param values since they're paths
          if (paramName !== 'ref') {
            val = encodeURIComponent(msg[paramName]);
          } else {
            val = msg[paramName];
          }
        }
      } else {
        val = msg[paramName];
      }

      if (isUrlParam) {
        url = url.replace(":" + paramName, val);
      } else {
        if (format == "json" && def.params[paramName].sendValueAsBody) {
          ret.query = val;
        } else if (format == "json") {
          ret.query[paramName] = val;
        } else if (format != "raw") {
          ret.query.push(paramName + "=" + val);
        }
      }
    });
    ret.url = url;
    return ret;
  }

  /**
   *  Client#httpSend(msg, block, callback) -> null
   *      - msg (Object): parameters to send as the request body
   *      - block (Object): parameter definition from the `routes.json` file that
   *          contains validation rules
   *      - callback (Function): function to be called when the request returns.
   *          If the the request returns with an error, the error is passed to
   *          the callback as its first argument (NodeJS-style).
   *
   *  Send an HTTP request to the server and pass the result to a callback.
   **/
  this.httpSend = function (msg, block, callback) {
    var self = this;
    var method = block.method.toLowerCase();
    var hasFileBody = block.hasFileBody;
    var hasBody = !hasFileBody && (typeof(msg.body) !== "undefined" || "head|get|delete".indexOf(method) === -1);
    var format = getRequestFormat.call(this, hasBody, block);
    var protocol = this.config.protocol || this.constants.protocol || "http";
    var port = this.config.port || (protocol == "https" ? 443 : 80);
    var host = block.host || this.config.host || this.constants.host;

    // Edge case for github enterprise uploadAsset:
    // 1) In public api, host changes to uploads.github.com. In enterprise, the host remains the same.
    // 2) In enterprise, the pathPrefix changes from: /api/v3 to /api/uploads.
    if ((this.config.host && this.config.host !== this.constants.host)
      && (block.host && block.host === "uploads.github.com")) {  // enterprise uploadAsset
      host = this.config.host;
      this.config.pathPrefix = "/api/uploads";
    }

    var obj = getQueryAndUrl(msg, block, format, self.config);
    var query = obj.query;
    var url = this.config.url ? this.config.url + obj.url : obj.url;
    var path = url;
    if (!hasBody && query.length) {
      path += "?" + query.join("&");
    }

    var proxyUrl;
    var agent = undefined;
    if (this.config.proxy !== undefined) {
      proxyUrl = this.config.proxy;
    } else {
      proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    }
    // if (proxyUrl) {
    //   agent = new HttpsProxyAgent(proxyUrl);
    // }

    var ca = this.config.ca;

    var headers = {
      "host": host,
      "content-length": "0"
    };
    if (hasBody) {
      if (format == "json") {
        query = JSON.stringify(query);
      } else if (format != "raw") {
        query = query.join("&");
      }
      headers["content-length"] = Buffer.byteLength(query, "utf8");
      headers["content-type"] = format == "json"
        ? "application/json; charset=utf-8"
        : format == "raw"
          ? "text/plain; charset=utf-8"
          : "application/x-www-form-urlencoded; charset=utf-8";
    }
    if (this.auth) {
      var basic;
      switch (this.auth.type) {
        case "oauth":
          if (this.auth.token) {
            path += (path.indexOf("?") === -1 ? "?" : "&") +
              "access_token=" + encodeURIComponent(this.auth.token);
          } else {
            path += (path.indexOf("?") === -1 ? "?" : "&") +
              "client_id=" + encodeURIComponent(this.auth.key) +
              "&client_secret=" + encodeURIComponent(this.auth.secret);
          }
          break;
        case "token":
          headers["Authorization"] = "token " + this.auth.token;
          break;
        case "integration":
          headers["Authorization"] = "Bearer " + this.auth.token;
          headers["accept"] = "application/vnd.github.machine-man-preview+json"
          break;
        case "basic":
          basic = new Buffer(this.auth.username + ":" + this.auth.password, "ascii").toString("base64");
          headers["Authorization"] = "Basic " + basic;
          break;
        case "netrc":
          var auth = netrc()[host];
          if (!auth) {
            throw new Error("~/.netrc authentication type chosen but no credentials found for '" + host + "'");
          }
          basic = new Buffer(auth.login + ":" + auth.password, "ascii").toString("base64");
          headers["Authorization"] = "Basic " + basic;
        default:
          break;
      }
    }

    function callCallback(err, result) {
      if (callback) {
        var cb = callback;
        callback = undefined;
        cb(err, result);
      }
    }

    function addCustomHeaders(customHeaders) {
      Object.keys(customHeaders).forEach(function (header) {
        var headerLC = header.toLowerCase();
        if (self.requestHeaders.indexOf(headerLC) == -1) {
          return;
        }
        headers[headerLC] = customHeaders[header];
      });
    }

    addCustomHeaders(Util.extend(msg.headers || {}, this.config.headers));

    if (!headers["user-agent"]) {
      headers["user-agent"] = "NodeJS HTTP Client";
    }

    if (!("accept" in headers)) {
      headers["accept"] = this.acceptUrls[block.url] || this.config.requestMedia || this.constants.requestMedia;
    }

    var options = {
      host: host,
      port: port,
      path: path,
      method: method,
      headers: headers,
      ca: ca
    };

    if (agent) {
      options.agent = agent;
    }

    if (this.config.rejectUnauthorized !== undefined) {
      options.rejectUnauthorized = this.config.rejectUnauthorized;
    }

    if (this.debug) {
      console.log("REQUEST: ", options);
    }

    function httpSendRequest() {
      // var request;
      if (isNode) {
        // var reqModuleName = self.config.followRedirects === false ? protocol : 'follow-redirects/' + protocol;
        // request = (require(reqModuleName) || {}).request;
        // if (typeof request !== 'function') throw new Error();
        //
        // var req = request(options, function(res) {
        //
        //   if (self.debug) {
        //     console.log("STATUS: " + res.statusCode);
        //     console.log("HEADERS: " + JSON.stringify(res.headers));
        //   }
        //   res.setEncoding("utf8");
        //   var data = "";
        //   res.on("data", function(chunk) {
        //     data += chunk;
        //   });
        //   res.on("error", function(err) {
        //     callCallback(err);
        //   });
        //   res.on("end", function() {
        //     if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
        //       callCallback(new error.HttpError(data, res.statusCode, res.headers));
        //     } else {
        //       res.data = data;
        //       callCallback(null, res);
        //     }
        //   });
        // });
        //
        // var timeout = (block.timeout !== undefined) ? block.timeout : self.config.timeout;
        // if (timeout) {
        //   req.setTimeout(timeout);
        // }
        //
        // req.on("error", function(e) {
        //   if (self.debug) {
        //     console.log("problem with request: " + e.message);
        //   }
        //   callCallback(e.message);
        // });
        //
        // req.on("timeout", function() {
        //   if (self.debug) {
        //     console.log("problem with request: timed out");
        //   }
        //   req.abort();
        //   callCallback(new error.GatewayTimeout());
        // });
        //
        // // write data to request body
        // if (hasBody && query.length) {
        //   if (self.debug) {
        //     console.log("REQUEST BODY: " + query + "\n");
        //   }
        //   req.write(query + "\n");
        // }
        //
        // if (isNode) {
        //   if (block.hasFileBody) {
        //     try {
        //       var fs = require("fs");
        //       var stream = fs.createReadStream(msg.filePath);
        //       stream.pipe(req);
        //     } catch(e) {}
        //   } else {
        //     req.end();
        //   }
        // }
      } else {
        if (typeof fetch === 'undefined') require('whatwg-fetch');
        if (typeof fetch !== 'function') throw new Error('Module not found: fetch');

        var httpStr = options.port === 443 ? 'https' : 'http';
        var uri = httpStr + '://' + options.host + options.path;

        if (hasBody) options.body = query;

        fetch(uri, options).then(function (res) {
          res.statusCode = res.statusCode || res.status;

          if (self.debug) {
            console.log("STATUS: " + res.statusCode);
            console.log("HEADERS: " + JSON.stringify(res.headers));
          }

          res.text().then(function (text) {
            var data;

            if (text) {
              try {
                data = JSON.parse(text);
              } catch (jsonParseError) {}
            }

            res.data = data;
            if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
              callCallback(new error.HttpError(data, res.statusCode, res.headers));
            } else {
              if (res.bodyUsed && res.body && !res.data) {
                res.data = res.body;
              }

              callCallback(null, res);
            }
          });
        }).catch(function (e) {
          callCallback(e);
        });
      }
    };

    if (hasFileBody && isNode) {
      // try {
      //   var fs = require("fs");
      //   fs.stat(msg.filePath, function(err, stat) {
      //     if (err) {
      //       callCallback(err);
      //     } else {
      //       headers["content-length"] = stat.size;
      //       headers["content-type"] = mime.lookup(msg.name);
      //       httpSendRequest();
      //     }
      //   });
      // } catch(e) {
      //   httpSendRequest();
      // }
    } else {
      httpSendRequest();
    }
  };

  this.sendError = function (err, block, msg, callback) {
    if (this.debug) {
      Util.log(err, block, msg, "error");
    }
    if (typeof err == "string") {
      err = new error.InternalServerError(err);
    }
    if (callback && typeof(callback) === "function") {
      callback(err);
    }
  };

  this.handler = function (msg, block, callback) {
    var self = this;
    this.httpSend(msg, block, function (err, res) {
      if (err) {
        return self.sendError(err, msg, null, callback);
      }

      var ret;
      try {
        var contentType = res.headers["content-type"];
        if (contentType && contentType.indexOf("application/json") !== -1) {
          ret = res.data && JSON.parse(res.data);
        } else {
          ret = { data: res.data };
        }
      } catch (ex) {
        if (callback) {
          callback(new error.InternalServerError(ex.message), res);
        }
        return;
      }

      if (!ret) {
        ret = {};
      }

      var headers = res.headers;
      if (typeof Header !== 'undefined' && headers instanceof Header) {
        // transform Header into a normal json object
        headers.forEach(function (value, key) { headers[key] = value; });
      } else if (headers.map) {
        var keys = Object.keys(headers.map);
        for (var i = 0, l = keys.length; i < l; i++) {
          var key = keys[i];
          if (Array.isArray(headers.map[key])) {
            headers[key] = headers.map[key] = headers.map[key][0];
          }
        }
      }

      ret.meta = {};
      self.responseHeaders.forEach(function (header) {
        if (headers[header]) {
          ret.meta[header] = headers[header];
        }
      });

      if (callback) {
        callback(null, ret);
      }
    });
  }
}).call(Client.prototype);

}).call(this,require('_process'))
},{"./error":1,"./promise":3,"./routes.json":4,"./util":5,"_process":14,"buffer/":7,"mime-types":12,"url":19,"whatwg-fetch":23}],3:[function(require,module,exports){
(function (global){
"use strict";

var Promise = global.Promise || null;

if (isFunction(Promise)) {
    new Promise(function(resolver) {
        if (!isFunction(resolver)) {
            Promise = null;
        }
    });
}

module.exports = Promise;

function isFunction(x) {
    return typeof x === "function";
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
module.exports={
    "defines": {
        "constants": {
            "name": "Github",
            "description": "A Node.JS module, which provides an object oriented wrapper for the GitHub v3 API.",
            "protocol": "https",
            "host": "api.github.com",
            "port": 443,
            "documentation": "https://developer.github.com/v3",
            "dateFormat": "YYYY-MM-DDTHH:MM:SSZ",
            "requestFormat": "json",
            "requestMedia": "application/vnd.github.v3+json"
        },
        "response-headers": [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Oauth-Scopes",
            "X-Poll-Interval",
            "X-GitHub-Request-Id",
            "Retry-After",
            "Link",
            "Location",
            "Last-Modified",
            "Etag",
            "Status"
        ],
        "request-headers": [
            "Authorization",
            "If-Modified-Since",
            "If-None-Match",
            "Cookie",
            "User-Agent",
            "Accept",
            "X-GitHub-OTP"
        ],
        "params": {
            "files": {
                "type": "Json",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "Files that make up this gist. The key of which should be a required string filename and the value another required hash with parameters: 'content'"
            },
            "owner": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "username": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "org": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "repo": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "branch": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "sha": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "description": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "gist_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "Id (SHA1 hash) of the gist."
            },
            "installation_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "repository_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "commit_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "Sha of the commit to comment on.",
                "description": "Sha of the commit to comment on."
            },
            "client_id": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "The 20 character OAuth app client key for which to create the token."
            },
            "column_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "project_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "repo_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "invitation_id": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "ref": {
                "type": "String",
                "required": true,
                "allow-empty": true,
                "validation": "",
                "invalidmsg": "",
                "description": "String of the name of the fully qualified reference (ie: heads/master). If it doesn’t have at least one slash, it will be rejected."
            },
            "number": {
                "type": "Number",
                "required": true,
                "validation": "^[0-9]+$",
                "invalidmsg": "",
                "description": ""
            },
            "issue_number": {
                "type": "Number",
                "required": true,
                "validation": "^[0-9]+$",
                "invalidmsg": "",
                "description": ""
            },
            "name": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "direction": {
                "type": "String",
                "required": false,
                "validation": "^(asc|desc)$",
                "invalidmsg": "asc or desc, default: desc.",
                "description": "",
                "enum": ["asc", "desc"],
                "default": "desc"
            },
            "since": {
                "type": "Date",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ"
            },
            "until": {
                "type": "Date",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ"
            },
            "state": {
                "type": "String",
                "required": false,
                "validation": "^(open|closed|all)$",
                "invalidmsg": "open, closed, all, default: open",
                "description": "",
                "enum": ["open", "closed", "all"],
                "default": "open"
            },
            "color": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "6 character hex code, without a leading #.",
                "description": "6 character hex code, without a leading #."
            },
            "base": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "The branch (or git ref) you want your changes pulled into. This should be an existing branch on the current repository. You cannot submit a pull request to one repo that requests a merge to a base of another repo."
            },
            "head": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "The branch (or git ref) where your changes are implemented."
            },
            "path": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "Relative path of the file to comment on.",
                "description": "Relative path of the file to comment on."
            },
            "position": {
                "type": "Number",
                "required": true,
                "validation": "",
                "invalidmsg": "Column index in the diff to comment on.",
                "description": "Column index in the diff to comment on."
            },
            "body": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "homepage": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "private": {
                "type": "Boolean",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "True to create a private repository, false to create a public one. Creating private repositories requires a paid GitHub account. Default is false.",
                "default": "false"
            },
            "has_issues": {
                "type": "Boolean",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "True to enable issues for this repository, false to disable them. Default is true.",
                "default": "true"
            },
            "has_wiki": {
                "type": "Boolean",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "True to enable the wiki for this repository, false to disable it. Default is true.",
                "default": "true"
            },
            "has_downloads": {
                "type": "Boolean",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "True to enable downloads for this repository, false to disable them. Default is true.",
                "default": "true"
            },
            "default_branch": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "Updates the default branch for this repository."
            },
            "title": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "key": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": ""
            },
            "page": {
                "type": "Number",
                "required": false,
                "validation": "^[0-9]+$",
                "invalidmsg": "",
                "description": "Page number of the results to fetch."
            },
            "per_page": {
                "type": "Number",
                "required": false,
                "validation": "^[0-9]+$",
                "invalidmsg": "",
                "description": "A custom page size up to 100. Default is 30.",
                "default": "30"
            },
            "scopes": {
                "type": "Array",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "A list of scopes that this authorization is in."
            },
            "note": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "A note to remind you what the OAuth token is for."
            },
            "note_url": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "A URL to remind you what app the OAuth token is for."
            },
            "auto_init": {
                "type": "Boolean",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "True to create an initial commit with empty README. Default is false",
                "default": "false"
            },
            "gitignore_template": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "Desired language or platform .gitignore template to apply. Ignored if auto_init parameter is not provided."
            },
            "license_template": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "Desired LICENSE template to apply. Use the name of the template without the extension. For example, \"mit\" or \"mozilla\"."
            },
            "order": {
                "type": "String",
                "required": false,
                "validation": "^(asc|desc)$",
                "invalidmsg": "The sort order if sort parameter is provided. One of asc or desc. Default: desc",
                "description": "asc or desc",
                "enum": ["asc", "desc"],
                "default": "desc"
            },
            "q": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "Search Term",
                "combined": true
            },
            "data": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "Raw data to send as the body of the request"
            },
            "privacy": {
                "type": "String",
                "required": false,
                "validation": "^(secret|closed)$",
                "invalidmsg": "secret, closed, default: secret",
                "description": "The level of privacy this team should have.",
                "enum": ["secret", "closed"],
                "default": "secret"
            },
            "fingerprint": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "A unique string to distinguish an authorization from others created for the same client ID and user."
            },
            "access_token": {
                "type": "String",
                "required": true,
                "validation": "",
                "invalidmsg": "",
                "description": "OAuth token"
            }
        },
        "acceptTree": {
            "application/vnd.github.cloak-preview+json": [
                "/search/commits"
            ],
            
            "application/vnd.github.ant-man-preview+json": [
                "/repos/:owner/:repo/deployments",
                "/repos/:owner/:repo/deployments/:id/statuses"
            ],
            
            "application/vnd.github.cryptographer-preview": [
                "/user/gpg_keys",
                "/user/gpg_keys/:id"
            ],
            
            "application/vnd.github.barred-rock-preview": [
                "/repos/:owner/:repo/import/authors",
                "/repos/:owner/:repo/import/authors/:author_id",
                "/:owner/:name/import/lfs",
                "/:owner/:name/import/large_files",
                "/repos/:owner/:repo/import"
            ],
            
            "application/vnd.github.machine-man-preview": [
                "/integration/installations",
                "/installations/:installation_id/access_tokens",
                "/integration/identity/user",
                "/installation/repositories",
                "/installations/:installation_id/repositories/:repository_id"
            ],
            
            "application/vnd.github.drax-preview+json": [
                "/licenses",
                "/licenses/:license",
                "/repos/:owner/:repo",
                "/repos/:owner/:repo/license"
            ],
            
            "application/vnd.github.wyandotte-preview+json": [
                "/orgs/:org/migrations",
                "/orgs/:org/migrations/:id",
                "/orgs/:org/migrations/:id/archive",
                "/orgs/:org/migrations/:id/repos/:repo_name/lock"
            ],
            
            "application/vnd.github.korra-preview+json": [
                "/orgs/:org",
                "/orgs/:org/invitations",
                "/orgs/:org/outside_collaborators",
                "/orgs/:org/outside_collaborator/:username",
                "/orgs/:org/teams",
                "/repos/:owner/:repo/collaborators",
                "/repos/:owner/:repo/collaborators/:username/permission",
                "/teams/:id/invitations"
            ],
            
            "application/vnd.github.mister-fantastic-preview+json": [
                "/repos/:owner/:repo/pages",
                "/repos/:owner/:repo/pages/builds",
                "/repos/:owner/:repo/pages/builds/latest",
                "/repos/:owner/:repo/pages/builds/:id"
            ],
            
            "application/vnd.github.eye-scream-preview": [
                "/admin/pre-receive-environments/:id",
                "/admin/pre_receive_environments",
                "/admin/pre-receive-environments/:id/downloads/latest",
                "/admin/pre_receive_environments/:id/downloads",
                "/admin/pre-receive-hooks/:id",
                "/admin/pre-receive-hooks"
            ],
            
            "application/vnd.github.inertia-preview+json": [
                "/repos/:owner/:repo/projects",
                "/orgs/:org/projects",
                "/projects/:id",
                "/projects/columns/:column_id/cards",
                "/projects/columns/cards/:id",
                "/projects/columns/cards/:id/moves",
                "/projects/:project_id/columns",
                "/projects/columns/:id",
                "/projects/columns/:id/moves"
            ],
            
            "application/vnd.github.loki-preview+json": [
                "/repos/:owner/:repo/branches",
                "/repos/:owner/:repo/branches/:branch",
                "/repos/:owner/:repo/branches/:branch/protection",
                "/repos/:owner/:repo/branches/:branch/protection/required_status_checks",
                "/repos/:owner/:repo/branches/:branch/protection/required_status_checks/contexts",
                "/repos/:owner/:repo/branches/:branch/protection/restrictions",
                "/repos/:owner/:repo/branches/:branch/protection/restrictions/teams",
                "/repos/:owner/:repo/branches/:branch/protection/restrictions/users"
            ],
            
            "application/vnd.github.polaris-preview": [
                "/repos/:owner/:repo/pulls/:number/merge"
            ],
            
            "application/vnd.github.squirrel-girl-preview": [
                "/repos/:owner/:repo/comments/:id/reactions",
                "/repos/:owner/:repo/issues/:number/reactions",
                "/repos/:owner/:repo/issues/comments/:id/reactions",
                "/repos/:owner/:repo/pulls/comments/:id/reactions",
                "/reactions/:id",
                "/repos/:owner/:repo/pulls/:number/comments",
                "/repos/:owner/:repo/pulls/comments",
                "/repos/:owner/:repo/pulls/comments/:id"
            ],
            
            "application/vnd.github.mockingbird-preview": [
                "/repos/:owner/:repo/issues/:issue_number/timeline"
            ],
            
            "application/vnd.github.black-cat-preview+json": [
                "/repos/:owner/:repo/pulls/:number/reviews",
                "/repos/:owner/:repo/pulls/:number/reviews/:id",
                "/repos/:owner/:repo/pulls/:number/reviews/:id/comments",
                "/repos/:owner/:repo/pulls/:number/reviews/:id/events",
                "/repos/:owner/:repo/pulls/:number/reviews/:id/dismissals",
                "/repos/:owner/:repo/pulls/:number/requested_reviewers"
            ]
        }
    },

    "authorization": {
        "get-grants": {
            "url": "/applications/grants",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List your grants."
        },

        "get-grant": {
            "url": "/applications/grants/:id",
            "method": "GET",
            "params": {
                "$id": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get a single grant."
        },

        "delete-grant": {
            "url": "/applications/grants/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a grant."
        },

        "get-all": {
            "url": "/authorizations",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List your authorizations."
        },

        "get": {
            "url": "/authorizations/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single authorization."
        },

        "create": {
            "url": "/authorizations",
            "method": "POST",
            "params": {
                "$scopes": null,
                "$note": null,
                "$note_url": null,
                "$client_id": null,
                "client_secret": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The 40 character OAuth app client secret for which to create the token."
                },
                "$fingerprint": null
            },
            "description": "Create a new authorization."
        },

        "get-or-create-authorization-for-app": {
            "url": "/authorizations/clients/:client_id",
            "method": "PUT",
            "params": {
                "$client_id": null,
                "client_secret": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The 40 character OAuth app client secret associated with the client ID specified in the URL."
                },
                "$scopes": null,
                "$note": null,
                "$note_url": null,
                "$fingerprint": null
            },
            "description": "Get or create an authorization for a specific app."
        },

        "get-or-create-authorization-for-app-and-fingerprint": {
            "url": "/authorizations/clients/:client_id/:fingerprint",
            "method": "PUT",
            "params": {
                "$client_id": null,
                "$fingerprint": null,
                "client_secret": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The 40 character OAuth app client secret associated with the client ID specified in the URL."
                },
                "$scopes": null,
                "$note": null,
                "$note_url": null
            },
            "description": "Get or create an authorization for a specific app and fingerprint."
        },

        "update": {
            "url": "/authorizations/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "$scopes": null,
                "add_scopes": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A list of scopes to add to this authorization."
                },
                "remove_scopes": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A list of scopes to remove from this authorization."
                },
                "$note": null,
                "$note_url": null,
                "$fingerprint": null
            },
            "description": "Update an existing authorization."
        },

        "delete": {
            "url": "/authorizations/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete an authorization."
        },

        "check": {
            "url": "/applications/:client_id/tokens/:access_token",
            "method": "GET",
            "params": {
                "$client_id": null,
                "$access_token": null
            },
            "description": "Check an authorization"
        },

        "reset": {
            "url": "/applications/:client_id/tokens/:access_token",
            "method": "POST",
            "params": {
                "$client_id": null,
                "$access_token": null
            },
            "description": "Reset an authorization"
        },

        "revoke": {
            "url": "/applications/:client_id/tokens/:access_token",
            "method": "DELETE",
            "params": {
                "$client_id": null,
                "$access_token": null
            },
            "description": "Revoke an authorization for an application"
        }
    },

    "activity": {
        "get-events": {
            "url": "/events",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List public events"
        },

        "get-events-for-repo": {
            "url": "/repos/:owner/:repo/events",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List repository events"
        },

        "get-events-for-repo-issues": {
            "url": "/repos/:owner/:repo/issues/events",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List issue events for a repository"
        },

        "get-events-for-repo-network": {
            "url": "/networks/:owner/:repo/events",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public events for a network of repositories"
        },

        "get-events-for-org": {
            "url": "/orgs/:org/events",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public events for an organization"
        },

        "get-events-received": {
            "url": "/users/:username/received_events",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events that a user has received"
        },

        "get-events-received-public": {
            "url": "/users/:username/received_events/public",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public events that a user has received"
        },

        "get-events-for-user": {
            "url": "/users/:username/events",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events performed by a user"
        },

        "get-events-for-user-public": {
            "url": "/users/:username/events/public",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public events performed by a user"
        },

        "get-events-for-user-org": {
            "url": "/users/:username/events/orgs/:org",
            "method": "GET",
            "params": {
                "$username": null,
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events for a user's organization"
        },

        "get-feeds": {
            "url": "/feeds",
            "method": "GET",
            "params": {},
            "description": "Get all feeds available for the authenticated user."
        },

        "get-notifications": {
            "url": "/notifications",
            "method": "GET",
            "params": {
                "all": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If true, show notifications marked as read. Default: false",
                    "default": "false"
                },
                "participating": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If true, only shows notifications in which the user is directly participating or mentioned. Default: false",
                    "default": "false"
                },
                "$since": null,
                "before": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Only show notifications updated before the given time. This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ."
                }
            },
            "description": "Get all notifications for the current user, grouped by repository."
        },

        "get-notifications-for-user": {
            "url": "/repos/:owner/:repo/notifications",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "all": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If true, show notifications marked as read. Default: false",
                    "default": "false"
                },
                "participating": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If true, only shows notifications in which the user is directly participating or mentioned. Default: false",
                    "default": "false"
                },
                "$since": null,
                "before": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Only show notifications updated before the given time. This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ."
                }
            },
            "description": "Get all notifications for the given user."
        },

        "mark-notifications-as-read": {
            "url": "/notifications",
            "method": "PUT",
            "params": {
                "last_read_at": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Describes the last point that notifications were checked. Anything updated since this time will not be updated. This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ. Default: Time.now",
                    "default": "Time.now"
                }
            },
            "description": "Mark notifications as read for authenticated user."
        },

        "mark-notifications-as-read-for-repo": {
            "url": "/repos/:owner/:repo/notifications",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "last_read_at": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Describes the last point that notifications were checked. Anything updated since this time will not be updated. This is a timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ. Default: Time.now",
                    "default": "Time.now"
                }
            },
            "description": "Mark notifications in a repo as read."
        },

        "get-notification-thread": {
            "url": "/notifications/threads/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "View a single notification thread."
        },

        "mark-notification-thread-as-read": {
            "url": "/notifications/threads/:id",
            "method": "PATCH",
            "params": {
                "$id": null
            },
            "description": "Mark a notification thread as read."
        },

        "check-notification-thread-subscription": {
            "url": "/notifications/threads/:id/subscription",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Check to see if the current user is subscribed to a thread."
        },

        "set-notification-thread-subscription": {
            "url": "/notifications/threads/:id/subscription",
            "method": "PUT",
            "params": {
                "$id": null,
                "subscribed": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines if notifications should be received from this thread"
                },
                "ignored": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines if all notifications should be blocked from this thread"
                }
            },
            "description": "This lets you subscribe or unsubscribe from a conversation. Unsubscribing from a conversation mutes all future notifications (until you comment or get @mentioned once more)."
        },

        "delete-notification-thread-subscription": {
            "url": "/notifications/threads/:id/subscription",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a notification thread subscription."
        },

        "get-stargazers-for-repo": {
            "url": "/repos/:owner/:repo/stargazers",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List Stargazers"
        },

        "get-starred-repos-for-user": {
            "url": "/users/:username/starred",
            "method": "GET",
            "params": {
                "$username": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated)$",
                    "invalidmsg": "created or updated (when it was last pushed to); default: created.",
                    "description": "",
                    "enum": ["created", "updated"],
                    "default": "created"
                },
                "$direction": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List repositories being starred by a user"
        },

        "get-starred-repos": {
            "url": "/user/starred",
            "method": "GET",
            "params": {
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated)$",
                    "invalidmsg": "created or updated (when it was last pushed to); default: created.",
                    "description": "",
                    "enum": ["created", "updated"],
                    "default": "created"
                },
                "$direction": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List repositories being starred by the authenticated user"
        },

        "check-starring-repo": {
            "url": "/user/starred/:owner/:repo",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Check if you are starring a repository"
        },

        "star-repo": {
            "url": "/user/starred/:owner/:repo",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Star a repository"
        },

        "unstar-repo": {
            "url": "/user/starred/:owner/:repo",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Unstar a repository"
        },

        "get-watchers-for-repo": {
            "url": "/repos/:owner/:repo/subscribers",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get watchers for repository."
        },

        "get-watched-repos-for-user": {
            "url": "/users/:username/subscriptions",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List repositories being watched by a user."
        },

        "get-watched-repos": {
            "url": "/user/subscriptions",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List repositories being watched by the authenticated user."
        },

        "get-repo-subscription": {
            "url": "/repos/:owner/:repo/subscription",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get a Repository Subscription."
        },

        "set-repo-subscription": {
            "url": "/repos/:owner/:repo/subscription",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "subscribed": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines if notifications should be received from this repository."
                },
                "ignored": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines if all notifications should be blocked from this repository."
                }
            },
            "description": "Set a Repository Subscription"
        },

        "unwatch-repo": {
            "url": "/repos/:owner/:repo/subscription",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Unwatch a repository."
        }
    },

    "gists": {
        "get-for-user": {
            "url": "/users/:username/gists",
            "method": "GET",
            "params": {
                "$username": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List a user's gists"
        },
        
        "get-all": {
            "url": "/gists",
            "method": "GET",
            "params": {
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List the authenticated user's gists or if called anonymously, this will return all public gists"
        },
        
        "get-public": {
            "url": "/gists/public",
            "method": "GET",
            "params": {
                "$since": null
            },
            "description": "List all public gists"
        },

        "get-starred": {
            "url": "/gists/starred",
            "method": "GET",
            "params": {
                "$since": null
            },
            "description": "List the authenticated user's starred gists"
        },

        "get": {
            "url": "/gists/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single gist"
        },

        "get-revision": {
            "url": "/gists/:id/:sha",
            "method": "GET",
            "params": {
                "$id": null,
                "$sha": null
            },
            "description": "Get a specific revision of a gist"
        },

        "create": {
            "url": "/gists",
            "method": "POST",
            "params": {
                "$files": null,
                "$description": null,
                "public": {
                    "type": "Boolean",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Create a gist"
        },

        "edit": {
            "url": "/gists/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "$description": null,
                "$files": null,
                "content": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Updated file contents."
                },
                "filename": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "New name for this file."
                }
            },
            "description": "Edit a gist"
        },

        "get-commits": {
            "url": "/gists/:id/commits",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "List gist commits"
        },

        "star": {
            "url": "/gists/:id/star",
            "method": "PUT",
            "params": {
                "$id": null
            },
            "description": "Star a gist"
        },

        "unstar": {
            "url": "/gists/:id/star",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Unstar a gist"
        },

        "check-star": {
            "url": "/gists/:id/star",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Check if a gist is starred"
        },

        "fork": {
            "url": "/gists/:id/forks",
            "method": "POST",
            "params": {
                "$id": null
            },
            "description": "Fork a gist"
        },

        "get-forks": {
            "url": "/gists/:id/forks",
            "method": "GET",
            "params": {
                "$id": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List gist forks"
        },

        "delete": {
            "url": "/gists/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a gist"
        },

        "get-comments": {
            "url": "/gists/:gist_id/comments",
            "method": "GET",
            "params": {
                "$gist_id": null
            },
            "description": "List comments on a gist"
        },

        "get-comment": {
            "url": "/gists/:gist_id/comments/:id",
            "method": "GET",
            "params": {
                "$gist_id": null,
                "$id": null
            },
            "description": "Get a single comment"
        },

        "create-comment": {
            "url": "/gists/:gist_id/comments",
            "method": "POST",
            "params": {
                "$gist_id": null,
                "$body": null
            },
            "description": "Create a comment"
        },

        "edit-comment": {
            "url": "/gists/:gist_id/comments/:id",
            "method": "PATCH",
            "params": {
                "$gist_id": null,
                "$id": null,
                "$body": null
            },
            "description": "Edit a comment"
        },

        "delete-comment": {
            "url": "/gists/:gist_id/comments/:id",
            "method": "DELETE",
            "params": {
                "$gist_id": null,
                "$id": null
            },
            "description": "Delete a comment"
        }
    },

    "gitdata": {
        "get-blob": {
            "url": "/repos/:owner/:repo/git/blobs/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get a Blob"
        },

        "create-blob": {
            "url": "/repos/:owner/:repo/git/blobs",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "content": {
                    "type": "String",
                    "required": true,
                    "allow-empty": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "encoding": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Create a Blob"
        },

        "get-commit": {
            "url": "/repos/:owner/:repo/git/commits/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null
            },
            "description": "Get a Commit"
        },

        "create-commit": {
            "url": "/repos/:owner/:repo/git/commits",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "message": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the commit message"
                },
                "tree": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the SHA of the tree object this commit points to"
                },
                "parents": {
                    "type": "Array",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Array of the SHAs of the commits that were the parents of this commit. If omitted or empty, the commit will be written as a root commit. For a single parent, an array of one SHA should be provided, for a merge commit, an array of more than one should be provided."
                },
                "author": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "committer": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Create a Commit"
        },

        "get-commit-signature-verification": {
            "url": "/repos/:owner/:repo/git/commits/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null
            },
            "description": "Get a Commit Signature Verification. (In preview period. See README.)"
        },

        "get-reference": {
            "url": "/repos/:owner/:repo/git/refs/:ref",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$ref": null
            },
            "description": "Get a Reference"
        },

        "get-references": {
            "url": "/repos/:owner/:repo/git/refs/",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get all References"
        },

        "get-tags": {
            "url": "/repos/:owner/:repo/git/refs/tags",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get all tag References"
        },

        "create-reference": {
            "url": "/repos/:owner/:repo/git/refs",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the fully qualified reference (ie: refs/heads/master). If it doesn't start with 'refs' and have at least two slashes, it will be rejected."
                },
                "$sha": null
            },
            "description": "Create a Reference"
        },

        "update-reference": {
            "url": "/repos/:owner/:repo/git/refs/:ref",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$ref": null,
                "$sha": null,
                "force": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Boolean indicating whether to force the update or to make sure the update is a fast-forward update. The default is false, so leaving this out or setting it to false will make sure you’re not overwriting work.",
                    "default": "false"
                }
            },
            "description": "Update a Reference"
        },

        "delete-reference": {
            "url": "/repos/:owner/:repo/git/refs/:ref",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$ref": null
            },
            "description": "Delete a Reference"
        },

        "get-tag": {
            "url": "/repos/:owner/:repo/git/tags/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null
            },
            "description": "Get a Tag"
        },

        "create-tag": {
            "url": "/repos/:owner/:repo/git/tags",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "tag": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the tag"
                },
                "message": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the tag message"
                },
                "object": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the SHA of the git object this is tagging"
                },
                "type": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the type of the object we’re tagging. Normally this is a commit but it can also be a tree or a blob."
                },
                "tagger": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains the following keys: `name` - String of the name of the author of the tag, `email` - String of the email of the author of the tag, `date` - Timestamp of when this object was tagged"
                }
            },
            "description": "Create a Tag Object"
        },

        "get-tag-signature-verification": {
            "url": "/repos/:owner/:repo/git/tags/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null
            },
            "description": "Get a Tag Signature Verification. (In preview period. See README.)"
        },

        "get-tree": {
            "url": "/repos/:owner/:repo/git/trees/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null,
                "recursive": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Get a Tree"
        },

        "create-tree": {
            "url": "/repos/:owner/:repo/git/trees",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "tree": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Array of Hash objects (of path, mode, type and sha) specifying a tree structure"
                },
                "base_tree": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the SHA1 of the tree you want to update with new data"
                }
            },
            "description": "Create a Tree"
        }
    },

    "integrations": {
        "get-installations": {
            "url": "/integration/installations",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List the integration's installations. (In preview period. See README.)"
        },
        
        "create-installation-token": {
            "url": "/installations/:installation_id/access_tokens",
            "method": "POST",
            "params": {
              "$installation_id": null,
              "user_id": {
                  "type": "String",
                  "required": false,
                  "validation": "",
                  "invalidmsg": "",
                  "description": "The id of the user for whom the integration is acting on behalf of."
              }
            },
            "description": "Create a new installation token. (In preview period. See README.)"
        },
        
        "get-user-identity": {
            "url": "/integration/identity/user",
            "method": "POST",
            "params": {
                "nonce": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Request identity of user. (In preview period. See README.)"
        },
        
        "get-installation-repositories": {
            "url": "/installation/repositories",
            "method": "GET",
            "params": {
                "user_id": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The integer ID of a user, to filter results to repositories that are visible to both the installation and the given user."
                }
            },
            "description": "List repositories that are accessible to the authenticated installation. (In preview period. See README.)"
        },
        
        "add-repo-to-installation": {
            "url": "/installations/:installation_id/repositories/:repository_id",
            "method": "POST",
            "params": {
                "$installation_id": null,
                "$repository_id": null
            },
            "description": "Add a single repository to an installation. (In preview period. See README.)"
        },
        
        "remove-repo-from-installation": {
            "url": "/installations/:installation_id/repositories/:repository_id",
            "method": "POST",
            "params": {
                "$installation_id": null,
                "$repository_id": null
            },
            "description": "Remove a single repository from an installation. (In preview period. See README.)"
        }
    },

    "issues": {
        "get-all": {
            "url": "/issues",
            "method": "GET",
            "params": {
                "filter": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|assigned|created|mentioned|subscribed)$",
                    "invalidmsg": "",
                    "description": "",
                    "enum": ["all", "assigned", "created", "mentioned", "subscribed"]
                },
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed|all)$",
                    "invalidmsg": "open, closed, all, default: open",
                    "description": "open, closed, or all",
                    "enum": ["open", "closed", "all"],
                    "default": "open"
                },
                "labels": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String list of comma separated Label names. Example: bug,ui,@high"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|comments)$",
                    "invalidmsg": "created, updated, comments, default: created.",
                    "description": "",
                    "enum": ["created", "updated", "comments"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List all issues across all the authenticated user's visible repositories including owned repositories, member repositories, and organization repositories"
        },

        "get-for-user": {
            "url": "/user/issues",
            "method": "GET",
            "params": {
                "filter": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|assigned|created|mentioned|subscribed)$",
                    "invalidmsg": "",
                    "description": "",
                    "enum": ["all", "assigned", "created", "mentioned", "subscribed"]
                },
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed|all)$",
                    "invalidmsg": "open, closed, all, default: open",
                    "description": "open, closed, or all",
                    "enum": ["open", "closed", "all"],
                    "default": "open"
                },
                "labels": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String list of comma separated Label names. Example: bug,ui,@high"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|comments)$",
                    "invalidmsg": "created, updated, comments, default: created.",
                    "description": "",
                    "enum": ["created", "updated", "comments"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List all issues across owned and member repositories for the authenticated user"
        },

        "get-for-org": {
            "url": "/orgs/:org/issues",
            "method": "GET",
            "params": {
                "$org": null,
                "filter": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|assigned|created|mentioned|subscribed)$",
                    "invalidmsg": "",
                    "description": "",
                    "enum": ["all", "assigned", "created", "mentioned", "subscribed"]
                },
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed|all)$",
                    "invalidmsg": "open, closed, all, default: open",
                    "description": "open, closed, or all",
                    "enum": ["open", "closed", "all"],
                    "default": "open"
                },
                "labels": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String list of comma separated Label names. Example: bug,ui,@high"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|comments)$",
                    "invalidmsg": "created, updated, comments, default: created.",
                    "description": "",
                    "enum": ["created", "updated", "comments"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List all issues for a given organization for the authenticated user"
        },

        "get-for-repo": {
            "url": "/repos/:owner/:repo/issues",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "milestone": {
                    "type": "String",
                    "required": false,
                    "validation": "^([0-9]+|none|\\*)$",
                    "invalidmsg": "",
                    "description": ""
                },
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed|all)$",
                    "invalidmsg": "open, closed, all, default: open",
                    "description": "open, closed, or all",
                    "enum": ["open", "closed", "all"],
                    "default": "open"
                },
                "assignee": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String User login, `none` for Issues with no assigned User. `*` for Issues with any assigned User."
                },
                "creator": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The user that created the issue."
                },
                "mentioned": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String User login."
                },
                "labels": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String list of comma separated Label names. Example: bug,ui,@high"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|comments)$",
                    "invalidmsg": "created, updated, comments, default: created.",
                    "description": "",
                    "enum": ["created", "updated", "comments"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List issues for a repository"
        },

        "get": {
            "url": "/repos/:owner/:repo/issues/:number",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Get a single issue"
        },

        "create": {
            "url": "/repos/:owner/:repo/issues",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "title": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "assignee": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Login for the user that this issue should be assigned to."
                },
                "milestone": {
                    "type": "Number",
                    "required": false,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": "Milestone to associate this issue with."
                },
                "labels": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Array of strings - Labels to associate with this issue."
                },
                "assignees": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Logins for Users to assign to this issue. NOTE: Only users with push access can set assignees for new issues. Assignees are silently dropped otherwise."
                }
            },
            "description": "Create an issue"
        },

        "edit": {
            "url": "/repos/:owner/:repo/issues/:number",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "title": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "assignee": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Login for the user that this issue should be assigned to."
                },
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed)$",
                    "invalidmsg": "open, closed, default: open",
                    "description": "open or closed",
                    "enum": ["open", "closed"],
                    "default": "open"
                },
                "milestone": {
                    "type": "Number",
                    "required": false,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": "Milestone to associate this issue with."
                },
                "labels": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Array of strings - Labels to associate with this issue."
                },
                "assignees": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Logins for Users to assign to this issue. Pass one or more user logins to replace the set of assignees on this Issue. .Send an empty array ([]) to clear all assignees from the Issue. NOTE: Only users with push access can set assignees for new issues. Assignees are silently dropped otherwise."
                }
            },
            "description": "Edit an issue"
        },

        "lock": {
            "url": "/repos/:owner/:repo/issues/:number/lock",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Users with push access can lock an issue's conversation."
        },

        "unlock": {
            "url": "/repos/:owner/:repo/issues/:number/lock",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Users with push access can unlock an issue's conversation."
        },

        "get-assignees": {
            "url": "/repos/:owner/:repo/assignees",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "List assignees"
        },

        "check-assignee": {
            "url": "/repos/:owner/:repo/assignees/:assignee",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "assignee": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Login for the user that this issue should be assigned to."
                }
            },
            "description": "Check assignee"
        },

        "add-assignees-to-issue": {
            "url": "/repos/:owner/:repo/issues/:number/assignees",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "assignees": {
                    "type": "Array",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Logins for the users that should be added to the issue."
                }
            },
            "description": "Add assignees to an issue."
        },

        "remove-assignees-from-issue": {
            "url": "/repos/:owner/:repo/issues/:number/assignees",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "body": {
                    "type": "Json",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains assignees array of logins for the users that should be removed from the issue."
                }
            },
            "description": "Remove assignees from an issue."
        },

        "get-comments": {
            "url": "/repos/:owner/:repo/issues/:number/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List comments on an issue"
        },

        "get-comments-for-repo": {
            "url": "/repos/:owner/:repo/issues/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated)$",
                    "invalidmsg": "created, updated, default: created.",
                    "description": "",
                    "enum": ["created", "updated"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List comments in a repository"
        },

        "get-comment": {
            "url": "/repos/:owner/:repo/issues/comments/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single comment"
        },

        "create-comment": {
            "url": "/repos/:owner/:repo/issues/:number/comments",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "body": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Create a comment"
        },

        "edit-comment": {
            "url": "/repos/:owner/:repo/issues/comments/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "body": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Edit a comment"
        },

        "delete-comment": {
            "url": "/repos/:owner/:repo/issues/comments/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a comment"
        },

        "get-events": {
            "url": "/repos/:owner/:repo/issues/:issue_number/events",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$issue_number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events for an issue"
        },

        "get-events-for-repo": {
            "url": "/repos/:owner/:repo/issues/events",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events for a repository"
        },

        "get-event": {
            "url": "/repos/:owner/:repo/issues/events/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single event"
        },
        
        "get-labels": {
            "url": "/repos/:owner/:repo/labels",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List all labels for this repository"
        },

        "get-label": {
            "url": "/repos/:owner/:repo/labels/:name",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null
            },
            "description": "Get a single label"
        },

        "create-label": {
            "url": "/repos/:owner/:repo/labels",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null,
                "$color": null
            },
            "description": "Create a label"
        },

        "update-label": {
            "url": "/repos/:owner/:repo/labels/:oldname",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "oldname": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The old name of the label."
                },
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new name of the label."
                },
                "$color": null
            },
            "description": "Update a label"
        },

        "delete-label": {
            "url": "/repos/:owner/:repo/labels/:name",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null
            },
            "description": "Delete a label"
        },

        "get-issue-labels": {
            "url": "/repos/:owner/:repo/issues/:number/labels",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "List labels on an issue"
        },

        "add-labels": {
            "url": "/repos/:owner/:repo/issues/:number/labels",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Add labels to an issue"
        },

        "remove-label": {
            "url": "/repos/:owner/:repo/issues/:number/labels/:name",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Remove a label from an issue"
        },

        "replace-all-labels": {
            "url": "/repos/:owner/:repo/issues/:number/labels",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Sending an empty array ([]) will remove all Labels from the Issue."
                }
            },
            "description": "Replace all labels for an issue"
        },

        "remove-all-labels": {
            "url": "/repos/:owner/:repo/issues/:number/labels",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Remove all labels from an issue"
        },

        "get-milestone-labels": {
            "url": "/repos/:owner/:repo/milestones/:number/labels",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Get labels for every issue in a milestone"
        },

        "get-milestones": {
            "url": "/repos/:owner/:repo/milestones",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$state": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(due_on|completeness)$",
                    "invalidmsg": "due_on, completeness, default: due_on",
                    "description": "due_on, completeness, default: due_on",
                    "enum": ["due_on", "completeness"],
                    "default": "due_on"
                },
                "direction": {
                    "type": "String",
                    "required": false,
                    "validation": "^(asc|desc)$",
                    "invalidmsg": "asc or desc, default: asc.",
                    "description": "",
                    "enum": ["asc", "desc"],
                    "default": "asc"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List milestones for a repository"
        },

        "get-milestone": {
            "url": "/repos/:owner/:repo/milestones/:number",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Get a single milestone"
        },

        "create-milestone": {
            "url": "/repos/:owner/:repo/milestones",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "title": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "$state": null,
                "$description": null,
                "due_on": {
                    "type": "Date",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ",
                    "description": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ"
                }
            },
            "description": "Create a milestone"
        },

        "update-milestone": {
            "url": "/repos/:owner/:repo/milestones/:number",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "title": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "$state": null,
                "$description": null,
                "due_on": {
                    "type": "Date",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ",
                    "description": "Timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ"
                }
            },
            "description": "Update a milestone"
        },

        "delete-milestone": {
            "url": "/repos/:owner/:repo/milestones/:number",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Delete a milestone"
        },
        
        "get-events-timeline": {
            "url": "/repos/:owner/:repo/issues/:issue_number/timeline",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$issue_number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List events for an issue. (In preview period. See README.)"
        }
    },

    "migrations": {
        "start-migration": {
            "url": "/orgs/:org/migrations",
            "method": "POST",
            "params": {
                "$org": null,
                "repositories": {
                    "type": "Array",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A list of arrays indicating which repositories should be migrated."
                },
                "lock_repositories": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Indicates whether repositories should be locked (to prevent manipulation) while migrating data. Default: false.",
                    "default": "false"
                },
                "exclude_attachments": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Indicates whether attachments should be excluded from the migration (to reduce migration archive file size). Default: false.",
                    "default": "false"
                }
            },
            "description": "Start a migration. (In preview period. See README.)"
        },

        "get-migrations": {
            "url": "/orgs/:org/migrations",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get a list of migrations. (In preview period. See README.)"
        },

        "get-migration-status": {
            "url": "/orgs/:org/migrations/:id",
            "method": "GET",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Get the status of a migration. (In preview period. See README.)"
        },

        "get-migration-archive-link": {
            "url": "/orgs/:org/migrations/:id/archive",
            "method": "GET",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Get the URL to a migration archive. (In preview period. See README.)"
        },

        "delete-migration-archive": {
            "url": "/orgs/:org/migrations/:id/archive",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Delete a migration archive. (In preview period. See README.)"
        },

        "unlock-repo-locked-for-migration": {
            "url": "/orgs/:org/migrations/:id/repos/:repo_name/lock",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$id": null,
                "repo_name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Unlock a repository that was locked for migration. (In preview period. See README.)"
        },

        "start-import": {
            "url": "/repos/:owner/:repo/import",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "vcs_url": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The URL of the originating repository."
                },
                "vcs": {
                    "type": "String",
                    "required": false,
                    "validation": "^(subversion|git|mercurial|tfvc)$",
                    "invalidmsg": "subversion, git, mercurial, tfvc",
                    "description": "The originating VCS type. Please be aware that without this parameter, the import job will take additional time to detect the VCS type before beginning the import. This detection step will be reflected in the response.",
                    "enum": ["subversion", "git", "mercurial", "tfvc"]
                },
                "vcs_username": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If authentication is required, the username to provide to vcs_url."
                },
                "vcs_password": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If authentication is required, the password to provide to vcs_url."
                },
                "tfvc_project": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "For a tfvc import, the name of the project that is being imported."
                }
            },
            "description": "Start an import. (In preview period. See README.)"
        },

        "get-import-progress": {
            "url": "/repos/:owner/:repo/import",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get import progress. (In preview period. See README.)"
        },

        "update-import": {
            "url": "/repos/:owner/:repo/import",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "vcs_username": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "The username to provide to the originating repository."
            },
            "vcs_password": {
                "type": "String",
                "required": false,
                "validation": "",
                "invalidmsg": "",
                "description": "The password to provide to the originating repository."
            },
            "description": "Update existing import. (In preview period. See README.)"
        },

        "get-import-commit-authors": {
            "url": "/repos/:owner/:repo/import/authors",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "since": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Only authors found after this id are returned. Provide the highest author ID you've seen so far. New authors may be added to the list at any point while the importer is performing the raw step."
                }
            },
            "description": "Get import commit authors. (In preview period. See README.)"
        },

        "map-import-commit-author": {
            "url": "/repos/:owner/:repo/import/authors/:author_id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "author_id": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The commit author id."
                },
                "email": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new Git author email."
                },
                "name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new Git author name."
                }
            },
            "description": "Map a commit author. (In preview period. See README.)"
        },

        "set-import-lfs-preference": {
            "url": "/:owner/:name/import/lfs",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$name": null,
                "use_lfs": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Can be one of `opt_in` (large files will be stored using Git LFS) or `opt_out` (large files will be removed during the import)."
                }
            },
            "description": "Set import LFS preference. (In preview period. See README.)"
        },

        "get-large-import-files": {
            "url": "/:owner/:name/import/large_files",
            "method": "GET",
            "params": {
                "$owner": null,
                "$name": null
            },
            "description": "List files larger than 100MB found during the import. (In preview period. See README.)"
        },

        "cancel-import": {
            "url": "/repos/:owner/:repo/import",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Cancel an import. (In preview period. See README.)"
        }
    },

    "misc": {
        "get-emojis": {
            "url": "/emojis",
            "method": "GET",
            "params": { },
            "description": "Lists all the emojis available to use on GitHub."
        },

        "get-gitignore-templates": {
            "url": "/gitignore/templates",
            "method": "GET",
            "params": { },
            "description": "Lists available gitignore templates"
        },

        "get-gitignore-template": {
            "url": "/gitignore/templates/:name",
            "method": "GET",
            "params": {
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the .gitignore template to get e.g. 'C'"
                }
            },
            "description": "Get a single gitignore template"
        },

        "get-licenses": {
            "url": "/licenses",
            "method": "GET",
            "params": { },
            "description": "List all licenses. (In preview period. See README.)"
        },

        "get-license": {
            "url": "/licenses/:license",
            "method": "GET",
            "params": {
                "license": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Ex: /licenses/mit"
                }
            },
            "description": "Get an individual license. (In preview period. See README.)"
        },

        "get-repo-license": {
            "url": "/repos/:owner/:repo/license",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the contents of a repository's license. (In preview period. See README.)"
        },

        "render-markdown": {
            "url": "/markdown",
            "method": "POST",
            "params": {
                "text": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The Markdown text to render"
                },
                "mode": {
                    "type": "String",
                    "required": false,
                    "validation": "^(markdown|gfm)$",
                    "invalidmsg": "",
                    "description": "The rendering mode, `markdown` to render a document as plain Markdown, just like README files are rendered. `gfm` to render a document as user-content, e.g. like user comments or issues are rendered. In GFM mode, hard line breaks are always taken into account, and issue and user mentions are linked accordingly.",
                    "enum": ["markdown", "gfm"],
                    "default": "markdown"
                },
                "context": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The repository context. Only taken into account when rendering as `gfm`"
                }
            },
            "description": "Render an arbitrary Markdown document"
        },

        "render-markdown-raw": {
            "url": "/markdown/raw",
            "method": "POST",
            "requestFormat": "raw",
            "params": {
                "$data": null
            },
            "description": "Render a Markdown document in raw mode"
        },

        "get-meta": {
            "url": "/meta",
            "method": "GET",
            "params": { },
            "description": "This endpoint provides information about GitHub.com, the service. Or, if you access this endpoint on your organization's GitHub Enterprise installation, this endpoint provides information about that installation."
        },

        "get-rate-limit": {
            "url": "/rate_limit",
            "method": "GET",
            "params": { },
            "description": "Get your current rate limit status"
        }
    },

    "orgs": {
        "get-all": {
            "url": "/organizations",
            "method": "GET",
            "params": {
                "since": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The integer ID of the last Organization that you've seen."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List all organizations"
        },

        "get-for-user": {
            "url": "/users/:username/orgs",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public organization memberships for the specified user."
        },

        "get": {
            "url": "/orgs/:org",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get an organization"
        },

        "update": {
            "url": "/orgs/:org",
            "method": "PATCH",
            "params": {
                "$org": null,
                "billing_email": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Billing email address. This address is not publicized."
                },
                "company": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The company name."
                },
                "email": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The publicly visible email address."
                },
                "location": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The location."
                },
                "name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The shorthand name of the company."
                },
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The description of the company."
                },
                "default_repository_permission": {
                    "type": "String",
                    "required": false,
                    "validation": "^(read|write|admin|none)$",
                    "invalidmsg": "read, write, admin, none, default: read",
                    "description": "Default permission level members have for organization repositories.",
                    "enum": ["read", "write", "admin", "none"],
                    "default": "read"
                },
                "members_can_create_repositories": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Toggles ability of non-admin organization members to create repositories.",
                    "default": true
                }
            },
            "description": "Edit an organization"
        },

        "get-members": {
            "url": "/orgs/:org/members",
            "method": "GET",
            "params": {
                "$org": null,
                "filter": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|2fa_disabled)$",
                    "invalidmsg": "all, 2fa_disabled, default: all",
                    "description": "Filter members returned in the list.",
                    "enum": ["all", "2fa_disabled"],
                    "default": "all"
                },
                "role": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|admin|member)$",
                    "invalidmsg": "all, admin, member, default: all",
                    "description": "Filter members returned by their role.",
                    "enum": ["all", "admin", "member"],
                    "default": "all"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Members list"
        },

        "check-membership": {
            "url": "/orgs/:org/members/:username",
            "method": "GET",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Check membership"
        },

        "remove-member": {
            "url": "/orgs/:org/members/:username",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Remove a member"
        },

        "get-public-members": {
            "url": "/orgs/:org/public_members",
            "method": "GET",
            "params": {
                "$org": null
            },
            "description": "Public members list"
        },

        "check-public-membership": {
            "url": "/orgs/:org/public_members/:username",
            "method": "GET",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Check public membership"
        },

        "publicize-membership": {
            "url": "/orgs/:org/public_members/:username",
            "method": "PUT",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Publicize a user's membership"
        },

        "conceal-membership": {
            "url": "/orgs/:org/public_members/:username",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Conceal a user's membership"
        },

        "get-org-membership": {
            "url": "/orgs/:org/memberships/:username",
            "method": "GET",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Get organization membership"
        },

        "add-org-membership": {
            "url": "/orgs/:org/memberships/:username",
            "method": "PUT",
            "params": {
                "$org": null,
                "$username": null,
                "role": {
                    "type": "String",
                    "required": true,
                    "validation": "^(admin|member)$",
                    "invalidmsg": "admin, member",
                    "description": "The role to give the user in the organization.",
                    "enum": ["admin", "member"]
                }
            },
            "description": "Add or update organization membership"
        },

        "remove-org-membership": {
            "url": "/orgs/:org/memberships/:username",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Remove organization membership"
        },
        
        "get-pending-org-invites": {
            "url": "/orgs/:org/invitations",
            "method": "GET",
            "params": {
                "$org": null
            },
            "description": "List pending organization invites."
        },
        
        "get-outside-collaborators": {
            "url": "/orgs/:org/outside_collaborators",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List all users who are outside collaborators of an organization."
        },
        
        "remove-outside-collaborator": {
            "url": "/orgs/:org/outside_collaborator/:username",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Remove outside collaborator."
        },
        
        "convert-member-to-outside-collaborator": {
            "url": "/orgs/:org/outside_collaborator/:username",
            "method": "PUT",
            "params": {
                "$org": null,
                "$username": null
            },
            "description": "Convert member to outside collaborator."
        },

        "get-teams": {
            "url": "/orgs/:org/teams",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List teams"
        },

        "get-team": {
            "url": "/teams/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get team"
        },

        "create-team": {
            "url": "/orgs/:org/teams",
            "method": "POST",
            "params": {
                "$org": null,
                "$name": null,
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The description of the team."
                },
                "maintainers": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The logins of organization members to add as maintainers of the team."
                },
                "repo_names": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The full name (e.g., \"organization-name/repository-name\") of repositories to add the team to."
                },
                "$privacy": null
            },
            "description": "Create team"
        },

        "edit-team": {
            "url": "/teams/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "$name": null,
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The description of the team."
                },
                "$privacy": null
            },
            "description": "Edit team"
        },

        "delete-team": {
            "url": "/teams/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete team"
        },

        "get-team-members": {
            "url": "/teams/:id/members",
            "method": "GET",
            "params": {
                "$id": null,
                "role": {
                    "type": "String",
                    "required": false,
                    "validation": "^(member|maintainer|all)$",
                    "invalidmsg": "member, maintainer, all, default: all",
                    "description": "Filters members returned by their role in the team.",
                    "enum": ["member", "maintainer", "all"],
                    "default": "all"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List team members"
        },

        "get-team-membership": {
            "url": "/teams/:id/memberships/:username",
            "method": "GET",
            "params": {
                "$id": null,
                "$username": null
            },
            "description": "Get team membership"
        },

        "add-team-membership": {
            "url": "/teams/:id/memberships/:username",
            "method": "PUT",
            "params": {
                "$id": null,
                "$username": null,
                "role": {
                    "type": "String",
                    "required": false,
                    "validation": "^(member|maintainer)$",
                    "invalidmsg": "member, maintainer, default: member",
                    "description": "The role that this user should have in the team.",
                    "enum": ["member", "maintainer"],
                    "default": "member"
                }
            },
            "description": "Add team membership"
        },

        "remove-team-membership": {
            "url": "/teams/:id/memberships/:username",
            "method": "DELETE",
            "params": {
                "$id": null,
                "$username": null
            },
            "description": "Remove team membership"
        },

        "get-team-repos": {
            "url": "/teams/:id/repos",
            "method": "GET",
            "params": {
                "$id": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get team repos"
        },
        
        "get-pending-team-invites": {
            "url": "/teams/:id/invitations",
            "method": "GET",
            "params": {
                "$id": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List pending team invitations."
        },

        "check-team-repo": {
            "url": "/teams/:id/repos/:owner/:repo",
            "method": "GET",
            "params": {
                "$id": null,
                "$owner": null,
                "$repo": null
            },
            "description": "Check if a team manages a repository"
        },

        "add-team-repo": {
            "url": "/teams/:id/repos/:org/:repo",
            "method": "PUT",
            "params": {
                "$id": null,
                "$org": null,
                "$repo": null,
                "permission": {
                    "type": "String",
                    "required": false,
                    "validation": "^(pull|push|admin)$",
                    "invalidmsg": "",
                    "description": "`pull` - team members can pull, but not push or administer this repository, `push` - team members can pull and push, but not administer this repository, `admin` - team members can pull, push and administer this repository.",
                    "enum": ["pull", "push", "admin"]
                }
            },
            "description": "Add team repository"
        },

        "delete-team-repo": {
            "url": "/teams/:id/repos/:owner/:repo",
            "method": "DELETE",
            "params": {
                "$id": null,
                "$owner": null,
                "$repo": null
            },
            "description": "Remove team repository"
        },

        "get-hooks": {
            "url": "/orgs/:org/hooks",
            "method": "GET",
            "params": {
                "$org": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List hooks"
        },

        "get-hook": {
            "url": "/orgs/:org/hooks/:id",
            "method": "GET",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Get single hook"
        },

        "create-hook": {
            "url": "/orgs/:org/hooks",
            "method": "POST",
            "params": {
                "$org": null,
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Must be passed as \"web\"."
                },
                "config": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Key/value pairs to provide settings for this webhook"
                },
                "events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines what events the hook is triggered for. Default: [\"push\"].",
                    "default": "[\"push\"]"
                },
                "active": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines whether the hook is actually triggered on pushes."
                }
            },
            "description": "Create a hook"
        },

        "edit-hook": {
            "url": "/orgs/:org/hooks/:id",
            "method": "PATCH",
            "params": {
                "$org": null,
                "$id": null,
                "config": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Key/value pairs to provide settings for this webhook"
                },
                "events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines what events the hook is triggered for. Default: [\"push\"].",
                    "default": "[\"push\"]"
                },
                "active": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines whether the hook is actually triggered on pushes."
                }
            },
            "description": "Edit a hook"
        },

        "ping-hook": {
            "url": "/orgs/:org/hooks/:id/pings",
            "method": "POST",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Ping a hook"
        },

        "delete-hook": {
            "url": "/orgs/:org/hooks/:id",
            "method": "DELETE",
            "params": {
                "$org": null,
                "$id": null
            },
            "description": "Delete a hook"
        }
    },

    "projects": {
        "get-repo-projects": {
            "url": "/repos/:owner/:repo/projects",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "List repository projects. (In preview period. See README.)"
        },

        "get-org-projects": {
            "url": "/orgs/:org/projects",
            "method": "GET",
            "params": {
                "$org": null
            },
            "description": "List organization projects. (In preview period. See README.)"
        },

        "get-project": {
            "url": "/projects/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a project. (In preview period. See README.)"
        },

        "create-repo-project": {
            "url": "/repos/:owner/:repo/projects",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null,
                "$body": null
            },
            "description": "Create a repository project. (In preview period. See README.)"
        },
        
        "create-org-project": {
            "url": "/orgs/:org/projects",
            "method": "POST",
            "params": {
                "$org": null,
                "$name": null,
                "$body": null
            },
            "description": "Create an organization project. (In preview period. See README.)"
        },

        "update-project": {
            "url": "/projects/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "$name": null,
                "$body": null
            },
            "description": "Update a project. (In preview period. See README.)"
        },

        "delete-project": {
            "url": "/projects/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a project. (In preview period. See README.)"
        },
        
        "get-project-cards": {
            "url": "/projects/columns/:column_id/cards",
            "method": "GET",
            "params": {
                "$column_id": null
            },
            "description": "List project cards. (In preview period. See README.)"
        },

        "get-project-card": {
            "url": "/projects/columns/cards/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get project card. (In preview period. See README.)"
        },

        "create-project-card": {
            "url": "/projects/columns/:column_id/cards",
            "method": "POST",
            "params": {
                "$column_id": null,
                "note": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The note of the card."
                },
                "content_id": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The id of the Issue or Pull Request to associate with this card."
                },
                "content_type": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The type of content to associate with this card. Can be either 'Issue' or 'PullRequest'."
                }
            },
            "description": "Create a project card. (In preview period. See README.)"
        },

        "update-project-card": {
            "url": "/projects/columns/cards/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "note": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The note of the card."
                }
            },
            "description": "Update a project card. (In preview period. See README.)"
        },

        "delete-project-card": {
            "url": "/projects/columns/cards/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a project card. (In preview period. See README.)"
        },

        "move-project-card": {
            "url": "/projects/columns/cards/:id/moves",
            "method": "POST",
            "params": {
                "$id": null,
                "position": {
                    "type": "String",
                    "required": true,
                    "validation": "^(top|bottom|after:\\d)$",
                    "invalidmsg": "",
                    "description": "Can be one of top, bottom, or after:<column-id>, where <column-id> is the id value of a column in the same project."
                },
                "column_id": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The id value of a column in the same project."
                }
            },
            "description": "Move a project card. (In preview period. See README.)"
        },

        "get-project-columns": {
            "url": "/projects/:project_id/columns",
            "method": "GET",
            "params": {
                "$project_id": null
            },
            "description": "List project columns. (In preview period. See README.)"
        },

        "get-project-column": {
            "url": "/projects/columns/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a project column. (In preview period. See README.)"
        },

        "create-project-column": {
            "url": "/projects/:project_id/columns",
            "method": "POST",
            "params": {
                "$project_id": null,
                "$name": null
            },
            "description": "Create a project column. (In preview period. See README.)"
        },

        "update-project-column": {
            "url": "/projects/columns/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "$name": null
            },
            "description": "Update a project column. (In preview period. See README.)"
        },

        "delete-project-column": {
            "url": "/projects/columns/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a project column. (In preview period. See README.)"
        },

        "move-project-column": {
            "url": "/projects/columns/:id/moves",
            "method": "POST",
            "params": {
                "$id": null,
                "position": {
                    "type": "String",
                    "required": true,
                    "validation": "^(first|last|after:\\d)$",
                    "invalidmsg": "",
                    "description": "Can be one of first, last, or after:<column-id>, where <column-id> is the id value of a column in the same project."
                }
            },
            "description": "Move a project column. (In preview period. See README.)"
        }
    },

    "pull-requests": {
        "get-all": {
            "url": "/repos/:owner/:repo/pulls",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(open|closed|all)$",
                    "invalidmsg": "open, closed, all, default: open",
                    "description": "open, closed, or all",
                    "enum": ["open", "closed", "all"],
                    "default": "open"
                },
                "head": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Filter pulls by head user and branch name in the format of user:ref-name. Example: github:new-script-format."
                },
                "base": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Filter pulls by base branch name. Example: gh-pages."
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|popularity|long-running)$",
                    "invalidmsg": "Possible values are: `created`, `updated`, `popularity`, `long-running`, Default: `created`",
                    "description": "Possible values are: `created`, `updated`, `popularity`, `long-running`, Default: `created`",
                    "enum": ["created", "updated", "popularity", "long-running"],
                    "default": "created"
                },
                "$direction": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List pull requests"
        },

        "get": {
            "url": "/repos/:owner/:repo/pulls/:number",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null
            },
            "description": "Get a single pull request"
        },

        "create": {
            "url": "/repos/:owner/:repo/pulls",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "title": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The title of the pull request."
                },
                "$head": null,
                "$base": null,
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The contents of the pull request."
                }
            },
            "description": "Create a pull request"
        },

        "create-from-issue": {
            "url": "/repos/:owner/:repo/pulls",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "issue": {
                    "type": "Number",
                    "required": true,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": "The issue number in this repository to turn into a Pull Request."
                },
                "$head": null,
                "$base": null
            },
            "description": "Create a pull request from an existing issue"
        },

        "update": {
            "url": "/repos/:owner/:repo/pulls/:number",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "title": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The title of the pull request."
                },
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The contents of the pull request."
                },
                "$state": null,
                "base": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The branch (or git ref) you want your changes pulled into. This should be an existing branch on the current repository. You cannot submit a pull request to one repo that requests a merge to a base of another repo."
                }
            },
            "description": "Update a pull request"
        },

        "get-commits": {
            "url": "/repos/:owner/:repo/pulls/:number/commits",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List commits on a pull request"
        },

        "get-files": {
            "url": "/repos/:owner/:repo/pulls/:number/files",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List pull requests files"
        },

        "check-merged": {
            "url": "/repos/:owner/:repo/pulls/:number/merge",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get if a pull request has been merged"
        },

        "merge": {
            "url": "/repos/:owner/:repo/pulls/:number/merge",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "commit_title": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Title for the automatic commit message. (In preview period. See README.)"
                },
                "commit_message": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Extra detail to append to automatic commit message."
                },
                "sha": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "SHA that pull request head must match to allow merge"
                },
                "merge_method": {
                    "type": "String",
                    "required": false,
                    "validation": "^(merge|squash|rebase)$",
                    "invalidmsg": "Possible values are: `merge`, `squash`, `rebase` Default: `merge`",
                    "description": "Merge method to use. Possible values are `merge`, `squash`, or `rebase`. (In preview period. See README.)",
                    "enum": ["merge", "squash", "rebase"],
                    "default": "merge"
                }
            },
            "description": "Merge a pull request (Merge Button)"
        },
        
        "get-reviews": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List reviews on a pull request. (In preview period. See README.)"
        },
        
        "get-review": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$id": null
            },
            "description": "Get a single pull request review. (In preview period. See README.)"
        },
        
        "get-review-comments": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews/:id/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$id": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get comments for a pull request review. (In preview period. See README.)"
        },
        
        "create-review": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The body text of the pull request review."
                },
                "event": {
                    "type": "String",
                    "required": false,
                    "validation": "^(APPROVE|REQUEST_CHANGES|COMMENT|PENDING)$",
                    "invalidmsg": "Possible values are: `APPROVE`, `REQUEST_CHANGES`, `COMMENT`, `PENDING`. Default: `PENDING`",
                    "description": "The event to perform on the review upon submission, can be one of APPROVE, REQUEST_CHANGES, or COMMENT. If left blank, the review will be in the PENDING state.",
                    "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT", "PENDING"],
                    "default": "PENDING"
                },
                "comments": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of comments part of the review."
                },
                "path": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The path to the file being commented on."
                },
                "position": {
                    "type": "Number",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The position in the file to be commented on."
                }
            },
            "description": "Create a pull request review. (In preview period. See README.)"
        },
        
        "submit-review": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews/:id/events",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$id": null,
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The body text of the pull request review."
                },
                "event": {
                    "type": "String",
                    "required": false,
                    "validation": "^(APPROVE|REQUEST_CHANGES|COMMENT|PENDING)$",
                    "invalidmsg": "Possible values are: `APPROVE`, `REQUEST_CHANGES`, `COMMENT`, `PENDING`. Default: `PENDING`",
                    "description": "The event to perform on the review upon submission, can be one of APPROVE, REQUEST_CHANGES, or COMMENT. If left blank, the review will be in the PENDING state.",
                    "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT", "PENDING"],
                    "default": "PENDING"
                }
            },
            "description": "Submit a pull request review. (In preview period. See README.)"
        },
        
        "dismiss-review": {
            "url": "/repos/:owner/:repo/pulls/:number/reviews/:id/dismissals",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$id": null,
                "message": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The message for the pull request review dismissal."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Dismiss a pull request review. (In preview period. See README.)"
        },
        
        "get-comments": {
            "url": "/repos/:owner/:repo/pulls/:number/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List comments on a pull request"
        },

        "get-comments-for-repo": {
            "url": "/repos/:owner/:repo/pulls/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated)$",
                    "invalidmsg": "Possible values are: `created`, `updated`, Default: `created`",
                    "description": "Possible values are: `created`, `updated`, Default: `created`",
                    "enum": ["created", "updated"],
                    "default": "created"
                },
                "$direction": null,
                "$since": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List comments in a repository"
        },

        "get-comment": {
            "url": "/repos/:owner/:repo/pulls/comments/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single comment"
        },

        "create-comment": {
            "url": "/repos/:owner/:repo/pulls/:number/comments",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$body": null,
                "$commit_id": null,
                "$path": null,
                "$position": null
            },
            "description": "Create a comment"
        },

        "create-comment-reply": {
            "url": "/repos/:owner/:repo/pulls/:number/comments",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$body": null,
                "in_reply_to": {
                    "type": "Number",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The comment id to reply to."
                }
            },
            "description": "Reply to existing pull request comment"
        },

        "edit-comment": {
            "url": "/repos/:owner/:repo/pulls/comments/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "$body": null
            },
            "description": "Edit a comment"
        },

        "delete-comment": {
            "url": "/repos/:owner/:repo/pulls/comments/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a comment"
        },
        
        "get-review-requests": {
            "url": "/repos/:owner/:repo/pulls/:number/requested_reviewers",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List review requests. (In preview period. See README.)"
        },
        
        "create-review-request": {
            "url": "/repos/:owner/:repo/pulls/:number/requested_reviewers",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "reviewers": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of user logins that will be requested."
                }
            },
            "description": "Create a review request. (In preview period. See README.)"
        },
        
        "delete-review-request": {
            "url": "/repos/:owner/:repo/pulls/:number/requested_reviewers",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "reviewers": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of user logins that will be requested."
                }
            },
            "description": "Delete a review request. (In preview period. See README.)"
        }
    },

    "reactions": {
        "get-for-commit-comment": {
            "url": "/repos/:owner/:repo/comments/:id/reactions",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": false,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "Indicates which type of reaction to return.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "List reactions for a commit comment. (In preview period. See README.)"
        },

        "create-for-commit-comment": {
            "url": "/repos/:owner/:repo/comments/:id/reactions",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "The reaction type.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "Create reaction for a commit comment. (In preview period. See README.)"
        },

        "get-for-issue": {
            "url": "/repos/:owner/:repo/issues/:number/reactions",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "content": {
                    "type": "String",
                    "required": false,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "Indicates which type of reaction to return.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "List reactions for an issue. (In preview period. See README.)"
        },

        "create-for-issue": {
            "url": "/repos/:owner/:repo/issues/:number/reactions",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$number": null,
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "The reaction type.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "Create reaction for an issue. (In preview period. See README.)"
        },

        "get-for-issue-comment": {
            "url": "/repos/:owner/:repo/issues/comments/:id/reactions",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": false,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "Indicates which type of reaction to return.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "List reactions for an issue comment. (In preview period. See README.)"
        },

        "create-for-issue-comment": {
            "url": "/repos/:owner/:repo/issues/comments/:id/reactions",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "The reaction type.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "Create reaction for an issue comment. (In preview period. See README.)"
        },

        "get-for-pull-request-review-comment": {
            "url": "/repos/:owner/:repo/pulls/comments/:id/reactions",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": false,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "Indicates which type of reaction to return.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "List reactions for a pull request review comment. (In preview period. See README.)"
        },

        "create-for-pull-request-review-comment": {
            "url": "/repos/:owner/:repo/pulls/comments/:id/reactions",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "^(\\+1|-1|laugh|confused|heart|hooray)$",
                    "invalidmsg": "Possible values: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`.",
                    "description": "The reaction type.",
                    "enum": ["+1", "-1", "laugh", "confused", "heart", "hooray"]
                }
            },
            "description": "Create reaction for a pull request review comment. (In preview period. See README.)"
        },

        "delete": {
            "url": "/reactions/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a reaction. (In preview period. See README.)"
        }
    },

    "repos": {
        "get-all": {
            "url": "/user/repos",
            "method": "GET",
            "params": {
                "visibility": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|public|private)$",
                    "invalidmsg": "Possible values: `all`, `public`, `private`, Default: `all`.",
                    "description": "Can be one of `all`, `public`, or `private`. Default: `all`.",
                    "enum": ["all", "public", "private"],
                    "default": "all"
                },
                "affiliation": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "Possible values: `owner`, `collaborator`, `organization_member`, Default: `owner,collaborator,organization_member`.",
                    "description": "Comma-separated list of values. Can include: `owner`, `collaborator`, `organization_member`.",
                    "default": "owner,collaborator,organization_member"
                },
                "type": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|owner|public|private|member)$",
                    "invalidmsg": "Possible values: `all`, `owner`, `public`, `private`, `member`. Default: `all`.",
                    "description": "Possible values: `all`, `owner`, `public`, `private`, `member`. Default: `all`.",
                    "enum": ["all", "owner", "public", "private", "member"],
                    "default": "all"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|pushed|full_name)$",
                    "invalidmsg": "Possible values: `created`, `updated`, `pushed`, `full_name`. Default: `full_name`.",
                    "description": "Possible values: `created`, `updated`, `pushed`, `full_name`. Default: `full_name`.",
                    "enum": ["created", "updated", "pushed", "full_name"],
                    "default": "full_name"
                },
                "$direction": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List your repositories"
        },

        "get-for-user": {
            "url": "/users/:username/repos",
            "method": "GET",
            "params": {
                "$username": null,
                "type": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|owner|member)$",
                    "invalidmsg": "Possible values: `all`, `owner`, `member`. Default: `owner`.",
                    "description": "Possible values: `all`, `owner`, `member`. Default: `owner`.",
                    "enum": ["all", "owner", "member"],
                    "default": "owner"
                },
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(created|updated|pushed|full_name)$",
                    "invalidmsg": "Possible values: `created`, `updated`, `pushed`, `full_name`. Default: `full_name`.",
                    "description": "Possible values: `created`, `updated`, `pushed`, `full_name`. Default: `full_name`.",
                    "enum": ["created", "updated", "pushed", "full_name"],
                    "default": "full_name"
                },
                "$direction": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public repositories for the specified user."
        },

        "get-for-org": {
            "url": "/orgs/:org/repos",
            "method": "GET",
            "params": {
                "$org": null,
                "type": {
                    "type": "String",
                    "required": false,
                    "validation": "^(all|public|private|forks|sources|member)$",
                    "invalidmsg": "Possible values: `all`, `public`, `private`, `forks`, `sources`, `member`. Default: `all`.",
                    "description": "Possible values: `all`, `public`, `private`, `forks`, `sources`, `member`. Default: `all`.",
                    "enum": ["all", "public", "private", "forks", "sources", "member"],
                    "default": "all"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List repositories for the specified org."
        },

        "get-public": {
            "url": "/repositories",
            "method": "GET",
            "params": {
                "since": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The integer ID of the last Repository that you've seen."
                }
            },
            "description": "List all public repositories"
        },

        "get-by-id": {
            "url": "/repositories/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single repo by id."
        },

        "create": {
            "url": "/user/repos",
            "method": "POST",
            "params": {
                "$name": null,
                "$description": null,
                "$homepage": null,
                "$private": null,
                "$has_issues": null,
                "$has_wiki": null,
                "$has_downloads": null,
                "team_id": {
                    "type": "Number",
                    "required": false,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": "The id of the team that will be granted access to this repository. This is only valid when creating a repository in an organization."
                },
                "$auto_init": null,
                "$gitignore_template": null,
                "$license_template": null,
                "allow_squash_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow squash-merging pull requests, or false to prevent squash-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_merge_commit": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow merging pull requests with a merge commit, or false to prevent merging pull requests with merge commits. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_rebase_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow rebase-merging pull requests, or false to prevent rebase-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                }
            },
            "description": "Create a new repository for the authenticated user."
        },
        
        "get": {
            "url": "/repos/:owner/:repo",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get a repo for a user."
        },

        "create-for-org": {
            "url": "/orgs/:org/repos",
            "method": "POST",
            "params": {
                "$org": null,
                "$name": null,
                "$description": null,
                "$homepage": null,
                "$private": null,
                "$has_issues": null,
                "$has_wiki": null,
                "$has_downloads": null,
                "team_id": {
                    "type": "Number",
                    "required": false,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": "The id of the team that will be granted access to this repository. This is only valid when creating a repo in an organization."
                },
                "$auto_init": null,
                "$gitignore_template": null,
                "$license_template": null,
                "allow_squash_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow squash-merging pull requests, or false to prevent squash-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_merge_commit": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow merging pull requests with a merge commit, or false to prevent merging pull requests with merge commits. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_rebase_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow rebase-merging pull requests, or false to prevent rebase-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                }
            },
            "description": "Create a new repository for an organization."
        },

        "edit": {
            "url": "/repos/:owner/:repo",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null,
                "$description": null,
                "$homepage": null,
                "$private": null,
                "$has_issues": null,
                "$has_wiki": null,
                "$has_downloads": null,
                "$default_branch": null,
                "allow_squash_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow squash-merging pull requests, or false to prevent squash-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_merge_commit": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow merging pull requests with a merge commit, or false to prevent merging pull requests with merge commits. Default: true. (In preview period. See README.)",
                    "default": "true"
                },
                "allow_rebase_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Either true to allow rebase-merging pull requests, or false to prevent rebase-merging. Default: true. (In preview period. See README.)",
                    "default": "true"
                }
            },
            "description": "Update a repo."
        },

        "get-contributors": {
            "url": "/repos/:owner/:repo/contributors",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "anon": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Set to 1 or true to include anonymous contributors in results."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Get contributors for the specified repository."
        },

        "get-languages": {
            "url": "/repos/:owner/:repo/languages",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get languages for the specified repository."
        },

        "get-teams": {
            "url": "/repos/:owner/:repo/teams",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get teams for the specified repository."
        },

        "get-tags": {
            "url": "/repos/:owner/:repo/tags",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get tags for the specified repository."
        },

        "delete": {
            "url": "/repos/:owner/:repo",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Delete a repository."
        },

        "get-branches": {
            "url": "/repos/:owner/:repo/branches",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "protected": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Set to true to only return protected branches"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List branches. (In preview period. See README.)"
        },

        "get-branch": {
            "url": "/repos/:owner/:repo/branches/:branch",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get branch. (In preview period. See README.)"
        },

        "get-branch-protection": {
            "url": "/repos/:owner/:repo/branches/:branch/protection",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get branch protection. (In preview period. See README.)"
        },

        "update-branch-protection": {
            "url": "/repos/:owner/:repo/branches/:branch/protection",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "required_status_checks": {
                    "type": "Json",
                    "required": true,
                    "allow-null": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains the following keys: `include_admins` - Enforce required status checks for repository administrators, `strict` - Require branches to be up to date before merging, `contexts` - The list of status checks to require in order to merge into this branch. This object can have the value of `null` for disabled."
                },
                "required_pull_request_reviews": {
                    "type": "Json",
                    "required": true,
                    "allow-null": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains the following keys: `include_admins` - Enforce required status checks for repository administrators."
                },
                "restrictions": {
                    "type": "Json",
                    "required": true,
                    "allow-null": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains the following keys: `users` - The list of user logins with push access, `teams` - The list of team slugs with push access. This object can have the value of `null` for disabled."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Update branch protection. (In preview period. See README.)"
        },

        "remove-branch-protection": {
            "url": "/repos/:owner/:repo/branches/:branch/protection",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Remove branch protection. (In preview period. See README.)"
        },

        "get-protected-branch-required-status-checks": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get required status checks of protected branch. (In preview period. See README.)"
        },

        "update-protected-branch-required-status-checks": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "include_admins": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Enforce required status checks for repository administrators."
                },
                "strict": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Require branches to be up to date before merging."
                },
                "contexts": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The list of status checks to require in order to merge into this branch."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Update required status checks of protected branch. (In preview period. See README.)"
        },

        "remove-protected-branch-required-status-checks": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Remove required status checks of protected branch. (In preview period. See README.)"
        },

        "get-protected-branch-required-status-checks-contexts": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks/contexts",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List required status checks contexts of protected branch. (In preview period. See README.)"
        },

        "replace-protected-branch-required-status-checks-contexts": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks/contexts",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of protected branch required status checks contexts (e.g. continuous-integration/jenkins)."
                }
            },
            "description": "Replace required status checks contexts of protected branch. (In preview period. See README.)"
        },

        "add-protected-branch-required-status-checks-contexts": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks/contexts",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of protected branch required status checks contexts (e.g. continuous-integration/jenkins)."
                }
            },
            "description": "Add required status checks contexts of protected branch. (In preview period. See README.)"
        },

        "remove-protected-branch-required-status-checks-contexts": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_status_checks/contexts",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of protected branch required status checks contexts (e.g. continuous-integration/jenkins)."
                }
            },
            "description": "Remove required status checks contexts of protected branch. (In preview period. See README.)"
        },

        "get-protected-branch-pull-request-review-enforcement": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_pull_request_reviews",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get pull request review enforcement of protected branch. (In preview period. See README.)"
        },

        "update-protected-branch-pull-request-review-enforcement": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_pull_request_reviews",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "include_admins": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Enforce required status checks for repository administrators."
                }
            },
            "description": "Update pull request review enforcement of protected branch. (In preview period. See README.)"
        },
        
        "remove-protected-branch-pull-request-review-enforcement": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/required_pull_request_reviews",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null
            },
            "description": "Remove pull request review enforcement of protected branch. (In preview period. See README.)"
        },

        "get-protected-branch-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get restrictions of protected branch. (In preview period. See README.)"
        },

        "remove-protected-branch-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null
            },
            "description": "Remove restrictions of protected branch. (In preview period. See README.)"
        },

        "get-protected-branch-team-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/teams",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List team restrictions of protected branch. (In preview period. See README.)"
        },

        "replace-protected-branch-team-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/teams",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Replace team restrictions of protected branch. (In preview period. See README.)"
        },

        "add-protected-branch-team-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/teams",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Add team restrictions of protected branch. (In preview period. See README.)"
        },

        "remove-protected-branch-team-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/teams",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Remove team restrictions of protected branch. (In preview period. See README.)"
        },

        "get-protected-branch-user-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/users",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List user restrictions of protected branch. (In preview period. See README.)"
        },

        "replace-protected-branch-user-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/users",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Replace user restrictions of protected branch. (In preview period. See README.)"
        },

        "add-protected-branch-user-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/users",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Add user restrictions of protected branch. (In preview period. See README.)"
        },

        "remove-protected-branch-user-restrictions": {
            "url": "/repos/:owner/:repo/branches/:branch/protection/restrictions/users",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$branch": null,
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An array of team slugs (e.g. justice-league)."
                }
            },
            "description": "Remove user restrictions of protected branch. (In preview period. See README.)"
        },

        "get-collaborators": {
            "url": "/repos/:owner/:repo/collaborators",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "affiliation": {
                    "type": "String",
                    "required": false,
                    "validation": "^(outside|all)$",
                    "invalidmsg": "outside, all, default: all",
                    "description": "Filter collaborators returned by their affiliation.",
                    "enum": ["outside", "all"],
                    "default": "all"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List collaborators"
        },

        "check-collaborator": {
            "url": "/repos/:owner/:repo/collaborators/:username",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$username": null
            },
            "description": "Check if user is a collaborator."
        },
        
        "review-user-permission-level": {
            "url": "/repos/:owner/:repo/collaborators/:username/permission",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$username": null
            },
            "description": "Review a user's permission level."
        },
        
        "add-collaborator": {
            "url": "/repos/:owner/:repo/collaborators/:username",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "$username": null,
                "permission": {
                    "type": "String",
                    "required": false,
                    "validation": "^(pull|push|admin)$",
                    "invalidmsg": "",
                    "description": "`pull` - can pull, but not push to or administer this repository, `push` - can pull and push, but not administer this repository, `admin` - can pull, push and administer this repository.",
                    "enum": ["pull", "push", "admin"],
                    "default": "push"
                }
            },
            "description": "Add user as a collaborator"
        },

        "remove-collaborator": {
            "url": "/repos/:owner/:repo/collaborators/:username",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$username": null
            },
            "description": "Remove user as a collaborator."
        },

        "get-all-commit-comments": {
            "url": "/repos/:owner/:repo/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List commit comments for a repository."
        },

        "get-commit-comments": {
            "url": "/repos/:owner/:repo/commits/:ref/comments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List comments for a single commit."
        },

        "create-commit-comment": {
            "url": "/repos/:owner/:repo/commits/:sha/comments",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null,
                "$body": null,
                "path": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Relative path of the file to comment on."
                },
                "position": {
                    "type": "Number",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Line index in the diff to comment on."
                },
                "line": {
                    "type": "Number",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Deprecated. Use position parameter instead. Line number in the file to comment on."
                }
            },
            "description": "Create a commit comment."
        },

        "get-commit-comment": {
            "url": "/repos/:owner/:repo/comments/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single commit comment."
        },

        "update-commit-comment": {
            "url": "/repos/:owner/:repo/comments/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "$body": null
            },
            "description": "Update a commit comment."
        },

        "delete-commit-comment": {
            "url": "/repos/:owner/:repo/comments/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a commit comment."
        },

        "get-commits": {
            "url": "/repos/:owner/:repo/commits",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "sha": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Sha or branch to start listing commits from."
                },
                "path": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Only commits containing this file path will be returned."
                },
                "author": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "GitHub login or email address by which to filter by commit author."
                },
                "$since": null,
                "$until": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List commits on a repository."
        },

        "get-commit": {
            "url": "/repos/:owner/:repo/commits/:sha",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null
            },
            "description": "Get a single commit."
        },

        "get-sha-of-commit-ref": {
            "url": "/repos/:owner/:repo/commits/:ref",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$ref": null
            },
            "description": "Get the SHA-1 of a commit reference."
        },

        "compare-commits": {
            "url": "/repos/:owner/:repo/compare/:base...:head",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$base": null,
                "$head": null
            },
            "description": "Compare two commits."
        },

        "get-readme": {
            "url": "/repos/:owner/:repo/readme",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the commit/branch/tag. Default: the repository’s default branch (usually master)"
                }
            },
            "description": "Get the README for the given repository."
        },

        "get-content": {
            "url": "/repos/:owner/:repo/contents/:path",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "path": {
                    "type": "String",
                    "required": true,
                    "allow-empty": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The content path."
                },
                "ref": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The String name of the Commit/Branch/Tag. Defaults to master."
                }
            },
            "description": "Get the contents of a file or directory in a repository."
        },

        "create-file": {
            "url": "/repos/:owner/:repo/contents/:path",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "path": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The content path."
                },
                "message": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The commit message."
                },
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new file content, Base64 encoded."
                },
                "branch": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The branch name. If not provided, uses the repository’s default branch (usually master)."
                },
                "committer": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Create a new file in the given repository."
        },

        "update-file": {
            "url": "/repos/:owner/:repo/contents/:path",
            "method": "PUT",
            "params": {
                "$owner": null,
                "$repo": null,
                "path": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The content path."
                },
                "message": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The commit message."
                },
                "content": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The updated file content, Base64 encoded."
                },
                "sha": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The blob SHA of the file being replaced."
                },
                "branch": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The branch name. If not provided, uses the repository’s default branch (usually master)."
                },
                "committer": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Update a file."
        },

        "delete-file": {
            "url": "/repos/:owner/:repo/contents/:path",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "path": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The content path."
                },
                "message": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The commit message."
                },
                "sha": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The blob SHA of the file being removed."
                },
                "branch": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The branch name. If not provided, uses the repository’s default branch (usually master)."
                },
                "committer": {
                    "type": "Json",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Delete a file."
        },

        "get-archive-link": {
            "url": "/repos/:owner/:repo/:archive_format/:ref",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "archive_format": {
                    "type": "String",
                    "required": true,
                    "validation": "^(tarball|zipball)$",
                    "invalidmsg": "Either tarball or zipball, Default: tarball.",
                    "description": "Either tarball or zipball, Deafult: tarball.",
                    "enum": ["tarball", "zipball"],
                    "default": "tarball"
                },
                "ref": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A valid Git reference. Default: the repository’s default branch (usually master)."
                }
            },
            "description": "Get archive link."
        },

        "get-keys": {
            "url": "/repos/:owner/:repo/keys",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List deploy keys."
        },

        "get-key": {
            "url": "/repos/:owner/:repo/keys/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a deploy key."
        },

        "create-key": {
            "url": "/repos/:owner/:repo/keys",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$title": null,
                "$key": null,
                "read_only": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "If true, the key will only be able to read repository contents. Otherwise, the key will be able to read and write."
                }
            },
            "description": "Add a new deploy key."
        },

        "delete-key": {
            "url": "/repos/:owner/:repo/keys/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Remove a deploy key."
        },

        "get-deployments": {
            "url": "/repos/:owner/:repo/deployments",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "sha": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The short or long sha that was recorded at creation time. Default: none.",
                    "default": "none"
                },
                "ref": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the ref. This can be a branch, tag, or sha. Default: none.",
                    "default": "none"
                },
                "task": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the task for the deployment. e.g. deploy or deploy:migrations. Default: none.",
                    "default": "none"
                },
                "environment": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the environment that was deployed to. e.g. staging or production. Default: none.",
                    "default": "none"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List deployments. (In preview period. See README.)"
        },

        "create-deployment": {
            "url": "/repos/:owner/:repo/deployments",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The ref to deploy. This can be a branch, tag, or sha."
                },
                "task": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The named task to execute. e.g. deploy or deploy:migrations. Default: deploy",
                    "default": "deploy"
                },
                "auto_merge": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Optional parameter to merge the default branch into the requested ref if it is behind the default branch. Default: true",
                    "default": "true"
                },
                "required_contexts": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Optional array of status contexts verified against commit status checks. If this parameter is omitted from the parameters then all unique contexts will be verified before a deployment is created. To bypass checking entirely pass an empty array. Defaults to all unique contexts."
                },
                "payload": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Optional JSON payload with extra information about the deployment. Default: \"\"",
                    "default": "\"\""
                },
                "environment": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the environment that was deployed to. e.g. staging or production. Default: none.",
                    "default": "none"
                },
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Optional short description. Default: \"\"",
                    "default": "\"\""
                },
                "transient_environment": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Specifies if the given environment is specific to the deployment and will no longer exist at some point in the future. Default: false. (In preview period. See README.)",
                    "default": false
                },
                "production_environment": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Specifies if the given environment is a one that end-users directly interact with. Default: true when environment is `production` and false otherwise. (In preview period. See README.)"
                }
            },
            "description": "Create a deployment. (In preview period. See README.)"
        },

        "get-deployment-statuses": {
            "url": "/repos/:owner/:repo/deployments/:id/statuses",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "List deployment statuses. (In preview period. See README.)"
        },

        "create-deployment-status": {
            "url": "/repos/:owner/:repo/deployments/:id/statuses",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The state of the status. Can be one of pending, success, error, or failure."
                },
                "target_url": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The target URL to associate with this status. This URL should contain output to keep the user updated while the task is running or serve as historical information for what happened in the deployment. Default: \"\"",
                    "default": "\"\""
                },
                "log_url": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Functionally equivalent to target_url. Default: \"\". (In preview period. See README.)",
                    "default": "\"\""
                },
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A short description of the status. Default: \"\"",
                    "default": "\"\""
                },
                "environment_url": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "URL for accessing the deployment environment. Default: \"\". (In preview period. See README.)",
                    "default": "\"\""
                },
                "auto_inactive": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "When true the new `inactive` status is added to all other non-transient, non-production environment deployments with the same repository and environment name as the created status's deployment. Default: true. (In preview period. See README.)",
                    "default": true
                }
            },
            "description": "Create a deployment status. (In preview period. See README.)"
        },

        "get-downloads": {
            "url": "/repos/:owner/:repo/downloads",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List downloads for repository."
        },

        "get-download": {
            "url": "/repos/:owner/:repo/downloads/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single download."
        },

        "delete-download": {
            "url": "/repos/:owner/:repo/downloads/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a download."
        },

        "get-forks": {
            "url": "/repos/:owner/:repo/forks",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(newest|oldest|stargazers)$",
                    "invalidmsg": "Possible values: `newest`, `oldest`, `stargazers`, default: `newest`.",
                    "description": "Possible values: `newest`, `oldest`, `stargazers`, default: `newest`.",
                    "enum": ["newest", "oldest", "stargazers"],
                    "default": "newest"
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List forks."
        },

        "fork": {
            "url": "/repos/:owner/:repo/forks",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "organization": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Optional parameter to specify the organization name if forking into an organization."
                }
            },
            "description": "Create a fork."
        },

        "get-invites": {
            "url": "/repositories/:repo_id/invitations",
            "method": "GET",
            "params": {
                "$repo_id": null
            },
            "description": "List invitations for a repository. (In preview period. See README.)"
        },

        "delete-invite": {
            "url": "/repositories/:repo_id/invitations/:invitation_id",
            "method": "DELETE",
            "params": {
                "$repo_id": null,
                "$invitation_id": null
            },
            "description": "Delete a repository invitation. (In preview period. See README.)"
        },

        "update-invite": {
            "url": "/repositories/:repo_id/invitations/:invitation_id",
            "method": "PATCH",
            "params": {
                "$repo_id": null,
                "$invitation_id": null,
                "permission": {
                    "type": "String",
                    "required": false,
                    "validation": "^(read|write|admin)$",
                    "invalidmsg": "Read, write, or admin.",
                    "description": "The permissions that the associated user will have on the repository.",
                    "enum": ["read", "write", "admin"]
                }
            },
            "description": "Update a repository invitation. (In preview period. See README.)"
        },

        "merge": {
            "url": "/repos/:owner/:repo/merges",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$base": null,
                "$head": null,
                "commit_message": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Commit message to use for the merge commit. If omitted, a default message will be used."
                }
            },
            "description": "Perform a merge."
        },

        "get-pages": {
            "url": "/repos/:owner/:repo/pages",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get information about a Pages site. (In preview period. See README.)"
        },

        "request-page-build": {
            "url": "/repos/:owner/:repo/pages/builds",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Request a page build. (In preview period. See README.)"
        },

        "get-pages-builds": {
            "url": "/repos/:owner/:repo/pages/builds",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List Pages builds. (In preview period. See README.)"
        },

        "get-latest-pages-build": {
            "url": "/repos/:owner/:repo/pages/builds/latest",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get latest Pages build. (In preview period. See README.)"
        },

        "get-pages-build": {
            "url": "/repos/:owner/:repo/pages/builds/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a specific Pages build. (In preview period. See README.)"
        },

        "get-releases": {
            "url": "/repos/:owner/:repo/releases",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List releases for a repository."
        },

        "get-release": {
            "url": "/repos/:owner/:repo/releases/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single release."
        },

        "get-latest-release": {
            "url": "/repos/:owner/:repo/releases/latest",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the latest release."
        },

        "get-release-by-tag": {
            "url": "/repos/:owner/:repo/releases/tags/:tag",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "tag": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the tag"
                }
            },
            "description": "Get a release by tag name."
        },

        "create-release": {
            "url": "/repos/:owner/:repo/releases",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "tag_name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the tag"
                },
                "target_commitish": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Specifies the commitish value that determines where the Git tag is created from. Can be any branch or commit SHA. Unused if the Git tag already exists. Default: the repository's default branch (usually master)."
                },
                "name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "draft": {
                    "type": "Boolean",
                    "validation": "",
                    "invalidmsg": "",
                    "description": "true to create a draft (unpublished) release, false to create a published one. Default: false",
                    "default": "false"
                },
                "prerelease": {
                    "type": "Boolean",
                    "validation": "",
                    "invalidmsg": "",
                    "description": "true to identify the release as a prerelease. false to identify the release as a full release. Default: false",
                    "default": "false"
                }
            },
            "description": "Create a release."
        },

        "edit-release": {
            "url": "/repos/:owner/:repo/releases/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "tag_name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "String of the tag"
                },
                "target_commitish": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Specifies the commitish value that determines where the Git tag is created from. Can be any branch or commit SHA. Unused if the Git tag already exists. Default: the repository's default branch (usually master)."
                },
                "name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "body": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                },
                "draft": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "true to create a draft (unpublished) release, false to create a published one. Default: false",
                    "default": "false"
                },
                "prerelease": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "true to identify the release as a prerelease. false to identify the release as a full release. Default: false",
                    "default": "false"
                }
            },
            "description": "Edit a release."
        },

        "delete-release": {
            "url": "/repos/:owner/:repo/releases/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a release"
        },

        "get-assets": {
            "url": "/repos/:owner/:repo/releases/:id/assets",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "List assets for a release."
        },

        "get-asset": {
            "url": "/repos/:owner/:repo/releases/assets/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get a single release asset."
        },

        "upload-asset": {
            "url": "/repos/:owner/:repo/releases/:id/assets",
            "method": "POST",
            "host": "uploads.github.com",
            "hasFileBody": true,
            "timeout": 0,
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "filePath": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The file path of the asset."
                },
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The file name of the asset. This should be set in a URI query parameter."
                },
                "label": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An alternate short description of the asset. Used in place of the filename. This should be set in a URI query parameter."
                }
            },
            "description": "Upload a release asset."
        },

        "edit-asset": {
            "url": "/repos/:owner/:repo/releases/assets/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "$name": null,
                "label": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "An alternate short description of the asset. Used in place of the filename."
                }
            },
            "description": "Edit a release asset."
        },

        "delete-asset": {
            "url": "/repos/:owner/:repo/releases/assets/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Delete a release asset."
        },

        "get-stats-contributors": {
            "url": "/repos/:owner/:repo/stats/contributors",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get contributors list with additions, deletions, and commit counts."
        },

        "get-stats-commit-activity": {
            "url": "/repos/:owner/:repo/stats/commit_activity",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the last year of commit activity data."
        },

        "get-stats-code-frequency": {
            "url": "/repos/:owner/:repo/stats/code_frequency",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the number of additions and deletions per week."
        },

        "get-stats-participation": {
            "url": "/repos/:owner/:repo/stats/participation",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the weekly commit count for the repository owner and everyone else."
        },

        "get-stats-punch-card": {
            "url": "/repos/:owner/:repo/stats/punch_card",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null
            },
            "description": "Get the number of commits per hour in each day."
        },

        "create-status": {
            "url": "/repos/:owner/:repo/statuses/:sha",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$sha": null,
                "state": {
                    "type": "String",
                    "required": true,
                    "validation": "^(pending|success|error|failure)$",
                    "invalidmsg": "",
                    "description": "State of the status - can be one of pending, success, error, or failure.",
                    "enum": ["pending", "success", "error", "failure"]
                },
                "target_url": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Target url to associate with this status. This URL will be linked from the GitHub UI to allow users to easily see the ‘source’ of the Status."
                },
                "description": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Short description of the status."
                },
                "context": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A string label to differentiate this status from the status of other systems."
                }
            },
            "description": "Create a status."
        },

        "get-statuses": {
            "url": "/repos/:owner/:repo/commits/:ref/statuses",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Ref to list the statuses from. It can be a SHA, a branch name, or a tag name."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "List statuses for a specfic ref."
        },

        "get-combined-status": {
            "url": "/repos/:owner/:repo/commits/:ref/status",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "ref": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Ref to fetch the status for. It can be a SHA, a branch name, or a tag name."
                },
                "$page": null,
                "$per_page": null
            },
            "description": "Get the combined status for a specific ref."
        },

        "get-referrers": {
            "url": "/repos/:owner/:repo/traffic/popular/referrers",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get the top 10 referrers over the last 14 days."
        },

        "get-paths": {
            "url": "/repos/:owner/:repo/traffic/popular/paths",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get the top 10 popular contents over the last 14 days."
        },

        "get-views": {
            "url": "/repos/:owner/:repo/traffic/views",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get the total number of views and breakdown per day or week for the last 14 days."
        },

        "get-clones": {
            "url": "/repos/:owner/:repo/traffic/clones",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Get the total number of clones and breakdown per day or week for the last 14 days."
        },

        "get-hooks": {
            "url": "/repos/:owner/:repo/hooks",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List hooks."
        },

        "get-hook": {
            "url": "/repos/:owner/:repo/hooks/:id",
            "method": "GET",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Get single hook."
        },

        "create-hook": {
            "url": "/repos/:owner/:repo/hooks",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$name": null,
                "config": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A Hash containing key/value pairs to provide settings for this hook. These settings vary between the services and are defined in the github-services repo. Booleans are stored internally as `1` for true, and `0` for false. Any JSON true/false values will be converted automatically."
                },
                "events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines what events the hook is triggered for. Default: `['push']`.",
                    "default": "[\"push\"]"
                },
                "active": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines whether the hook is actually triggered on pushes."
                }
            },
            "description": "Create a hook."
        },

        "edit-hook": {
            "url": "/repos/:owner/:repo/hooks/:id",
            "method": "PATCH",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null,
                "$name": null,
                "config": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A Hash containing key/value pairs to provide settings for this hook. Modifying this will replace the entire config object. These settings vary between the services and are defined in the github-services repo. Booleans are stored internally as `1` for true, and `0` for false. Any JSON true/false values will be converted automatically."
                },
                "events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines what events the hook is triggered for. This replaces the entire array of events. Default: `['push']`.",
                    "default": "[\"push\"]"
                },
                "add_events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines a list of events to be added to the list of events that the Hook triggers for."
                },
                "remove_events": {
                    "type": "Array",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines a list of events to be removed from the list of events that the Hook triggers for."
                },
                "active": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Determines whether the hook is actually triggered on pushes."
                }
            },
            "description": "Edit a hook."
        },

        "test-hook": {
            "url": "/repos/:owner/:repo/hooks/:id/tests",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Test a [push] hook."
        },

        "ping-hook": {
            "url": "/repos/:owner/:repo/hooks/:id/pings",
            "method": "POST",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Ping a hook."
        },

        "delete-hook": {
            "url": "/repos/:owner/:repo/hooks/:id",
            "method": "DELETE",
            "params": {
                "$owner": null,
                "$repo": null,
                "$id": null
            },
            "description": "Deleate a hook."
        }
    },

    "search": {
        "repos": {
            "url": "/search/repositories",
            "method": "GET",
            "params": {
                "$q": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(stars|forks|updated)$",
                    "invalidmsg": "One of stars, forks, or updated. Default: results are sorted by best match.",
                    "description": "stars, forks, or updated",
                    "enum": ["stars", "forks", "updated"]
                },
                "$order": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Search repositories."
        },

        "code": {
            "url": "/search/code",
            "method": "GET",
            "params": {
                "$q": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^indexed$",
                    "invalidmsg": "indexed only",
                    "description": "The sort field. Can only be indexed, which indicates how recently a file has been indexed by the GitHub search infrastructure. Default: results are sorted by best match.",
                    "enum": ["indexed"]
                },
                "$order": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Search code."
        },

        "commits": {
            "url": "/search/commits",
            "method": "GET",
            "params": {
                "$q": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(author-date|committer-date)$",
                    "invalidmsg": "author-date or committer-date",
                    "description": "The sort field. Can be author-date or committer-date. Default: best match.",
                    "enum": ["author-date", "committer-date"]
                },
                "$order": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Search commits. (In preview period. See README.)"
        },

        "issues": {
            "url": "/search/issues",
            "method": "GET",
            "params": {
                "$q": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(comments|created|updated)$",
                    "invalidmsg": "comments, created, or updated",
                    "description": "The sort field. Can be comments, created, or updated. Default: results are sorted by best match.",
                    "enum": ["comments", "created", "updated"]
                },
                "$order": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Search issues."
        },

        "users": {
            "url": "/search/users",
            "method": "GET",
            "params": {
                "$q": null,
                "sort": {
                    "type": "String",
                    "required": false,
                    "validation": "^(followers|repositories|joined)$",
                    "invalidmsg": "Can be followers, repositories, or joined. Default: results are sorted by best match.",
                    "description": "The sort field. Can be followers, repositories, or joined. Default: results are sorted by best match.",
                    "enum": ["followers", "repositories", "joined"]
                },
                "$order": null,
                "$page": null,
                "$per_page": null
            },
            "description": "Search users."
        },

        "email": {
            "url": "/legacy/user/email/:email",
            "method": "GET",
            "params": {
                "email": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The email address"
                }
            },
            "description": "Search against public email addresses."
        }
    },

    "users": {
        "get-for-user": {
            "url": "/users/:username",
            "method": "GET",
            "params": {
                "$username": null
            },
            "description": "Get a single user"
        },
        
        "get-by-id": {
            "url": "/user/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single user by GitHub ID"
        },
        
        "get": {
            "url": "/user",
            "method": "GET",
            "params": {},
            "description": "Get the authenticated user"
        },

        "update": {
            "url": "/user",
            "method": "PATCH",
            "params": {
                "name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new name of the user"
                },
                "email": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Publicly visible email address."
                },
                "blog": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new blog URL of the user."
                },
                "company": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new company of the user."
                },
                "location": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new location of the user."
                },
                "hireable": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new hiring availability of the user."
                },
                "bio": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new short biography of the user."
                }
            },
            "description": "Update the authenticated user"
        },

        "get-all": {
            "url": "/users",
            "method": "GET",
            "params": {
                "since":{
                    "type": "Number",
                    "required": false,
                    "validation": "",
                    "description": "The integer ID of the last User that you’ve seen."
                }
            },
            "description": "Get all users"
        },

        "get-orgs": {
            "url": "/user/orgs",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List organizations for the authenticated user."
        },

        "get-org-memberships": {
            "url": "/user/memberships/orgs",
            "method": "GET",
            "params": {
                "state": {
                    "type": "String",
                    "required": false,
                    "validation": "^(active|pending)$",
                    "invalidmsg": "active, pending",
                    "description": "Indicates the state of the memberships to return. Can be either active or pending. If not specified, both active and pending memberships are returned.",
                    "enum": ["active", "pending"]
                }
            },
            "description": "List your organization memberships"
        },

        "get-org-membership": {
            "url": "/user/memberships/orgs/:org",
            "method": "GET",
            "params": {
                "$org": null
            },
            "description": "Get your organization membership"
        },

        "edit-org-membership": {
            "url": "/user/memberships/orgs/:org",
            "method": "PATCH",
            "params": {
                "$org": null,
                "state": {
                    "type": "String",
                    "required": true,
                    "validation": "^(active)$",
                    "invalidmsg": "active",
                    "description": "The state that the membership should be in. Only \"active\" will be accepted.",
                    "enum": ["active"]
                }
            },
            "description": "Edit your organization membership"
        },

        "get-teams": {
            "url": "/user/teams",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "Get your teams"
        },

        "get-emails": {
            "url": "/user/emails",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List email addresses for a user"
        },

        "add-emails": {
            "url": "/user/emails",
            "method": "POST",
            "params": {
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "You can post a single email address or an array of addresses."
                }
            },
            "description": "Add email address(es)"
        },

        "delete-emails": {
            "url": "/user/emails",
            "method": "DELETE",
            "params": {
                "body": {
                    "type": "Array",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "You can post a single email address or an array of addresses."
                }
            },
            "description": "Delete email address(es)"
        },

        "get-followers-for-user": {
            "url": "/users/:username/followers",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List a user's followers"
        },

        "get-followers": {
            "url": "/user/followers",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List the authenticated user's followers"
        },

        "get-following-for-user": {
            "url": "/users/:username/following",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List who a user is following"
        },

        "get-following": {
            "url": "/user/following",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List who the authenticated user is following"
        },

        "check-following": {
            "url": "/user/following/:username",
            "method": "GET",
            "params": {
                "$username": null
            },
            "description": "Check if you are following a user"
        },

        "check-if-one-followers-other": {
            "url": "/users/:username/following/:target_user",
            "method": "GET",
            "params": {
                "$username": null,
                "target_user": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Check if one user follows another"
        },

        "follow-user": {
            "url": "/user/following/:username",
            "method": "PUT",
            "params": {
                "$username": null
            },
            "description": "Follow a user"
        },

        "unfollow-user": {
            "url": "/user/following/:username",
            "method": "DELETE",
            "params": {
                "$username": null
            },
            "description": "Unfollow a user"
        },

        "get-keys-for-user": {
            "url": "/users/:username/keys",
            "method": "GET",
            "params": {
                "$username": null,
                "$page": null,
                "$per_page": null
            },
            "description": "List public keys for a user"
        },

        "get-keys": {
            "url": "/user/keys",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List your public keys"
        },

        "get-key": {
            "url": "/user/keys/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single public key"
        },

        "create-key": {
            "url": "/user/keys",
            "method": "POST",
            "params": {
                "$title": null,
                "$key": null
            },
            "description": "Create a public key"
        },

        "delete-key": {
            "url": "/user/keys/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a public key"
        },

        "get-gpg-keys": {
            "url": "/user/gpg_keys",
            "method": "GET",
            "params": {
                "$page": null,
                "$per_page": null
            },
            "description": "List your GPG keys. (In preview period. See README.)"
        },

        "get-gpg-key": {
            "url": "/user/gpg_keys/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single GPG key. (In preview period. See README.)"
        },

        "create-gpg-key": {
            "url": "/user/gpg_keys",
            "method": "POST",
            "params": {
                "armored_public_key": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "GPG key contents"
                }
            },
            "description": "Create a GPG key. (In preview period. See README.)"
        },

        "delete-gpg-key": {
            "url": "/user/gpg_keys/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a GPG key. (In preview period. See README.)"
        },

        "promote": {
            "url": "/users/:username/site_admin",
            "method": "PUT",
            "params": {
                "$username": null
            },
            "description": "Promote an ordinary user to a site administrator"
        },

        "demote": {
            "url": "/users/:username/site_admin",
            "method": "DELETE",
            "params": {
                "$username": null
            },
            "description": "Demote a site administrator to an ordinary user"
        },

        "suspend": {
            "url": "/users/:username/suspended",
            "method": "PUT",
            "params": {
                "$username": null
            },
            "description": "Suspend a user"
        },

        "unsuspend": {
            "url": "/users/:username/suspended",
            "method": "DELETE",
            "params": {
                "$username": null
            },
            "description": "Unsuspend a user"
        },

        "get-repo-invites": {
            "url": "/user/repository_invitations",
            "method": "GET",
            "params": {
            },
            "description": "List a user's repository invitations. (In preview period. See README.)"
        },

        "accept-repo-invite": {
            "url": "/user/repository_invitations/:invitation_id",
            "method": "PATCH",
            "params": {
                "$invitation_id": null
            },
            "description": "Accept a repository invitation. (In preview period. See README.)"
        },

        "decline-repo-invite": {
            "url": "/user/repository_invitations/:invitation_id",
            "method": "DELETE",
            "params": {
                "$invitation_id": null
            },
            "description": "Decline a repository invitation. (In preview period. See README.)"
        }
    },

    "enterprise": {
        "stats": {
            "url": "/enterprise/stats/:type",
            "method": "GET",
            "params": {
                "type": {
                    "type": "String",
                    "required": true,
                    "validation": "^(issues|hooks|milestones|orgs|comments|pages|users|gists|pulls|repos|all)$",
                    "invalidmsg": "Possible values: issues, hooks, milestones, orgs, comments, pages, users, gists, pulls, repos, all.",
                    "description": "Possible values: issues, hooks, milestones, orgs, comments, pages, users, gists, pulls, repos, all.",
                    "enum": ["issues", "hooks", "milestones", "orgs", "comments", "pages", "users", "gists", "pulls", "repos", "all"]
                }
            },
            "description": "Get statistics."
        },

        "update-ldap-for-user": {
            "url": "/admin/ldap/users/:username/mapping",
            "method": "PATCH",
            "params": {
                "$username": null,
                "ldap_dn": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "Invalid DN",
                    "description": "LDAP DN for user"
                }
            },
            "description": "Update LDAP mapping for a user."
        },

        "sync-ldap-for-user": {
            "url": "/admin/ldap/users/:username/sync",
            "method": "POST",
            "params": {
                "$username": null
            },
            "description": "Sync LDAP mapping for a user."
        },

        "update-ldap-for-team": {
            "url": "/admin/ldap/teams/:team_id/mapping",
            "method": "PATCH",
            "params": {
                "team_id": {
                    "type": "Number",
                    "required": true,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": ""
                },
                "ldap_dn": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "Invalid DN",
                    "description": "LDAP DN for user"
                }
            },
            "description": "Update LDAP mapping for a team."
        },

        "sync-ldap-for-team": {
            "url": "/admin/ldap/teams/:team_id/sync",
            "method": "POST",
            "params": {
                "team_id": {
                    "type": "Number",
                    "required": true,
                    "validation": "^[0-9]+$",
                    "invalidmsg": "",
                    "description": ""
                }
            },
            "description": "Sync LDAP mapping for a team."
        },

        "get-license": {
            "url": "/enterprise/settings/license",
            "method": "GET",
            "params": {
                
            },
            "description": "Get license information"
        },

        "get-pre-receive-environment": {
            "url": "/admin/pre-receive-environments/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single pre-receive environment. (In preview period. See README.)"
        },
        
        "get-pre-receive-environments": {
            "url": "/admin/pre_receive_environments",
            "method": "GET",
            "params": {
            },
            "description": "List pre-receive environments. (In preview period. See README.)"
        },
        
        "create-pre-receive-environment": {
            "url": "/admin/pre_receive_environments",
            "method": "POST",
            "params": {
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The new pre-receive environment's name."
                },
                "image_url": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "URL from which to download a tarball of this environment."
                }
            },
            "description": "Create a pre-receive environment. (In preview period. See README.)"
        },
        
        "edit-pre-receive-environment": {
            "url": "/admin/pre_receive_environments/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "This pre-receive environment's new name."
                },
                "image_url": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "URL from which to download a tarball of this environment."
                }
            },
            "description": "Create a pre-receive environment. (In preview period. See README.)"
        },
        
        "delete-pre-receive-environment": {
            "url": "/admin/pre_receive_environments/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a pre-receive environment. (In preview period. See README.)"
        },
        
        "get-pre-receive-environment-download-status": {
            "url": "/admin/pre-receive-environments/:id/downloads/latest",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a pre-receive environment's download status. (In preview period. See README.)"
        },
        
        "trigger-pre-receive-environment-download": {
            "url": "/admin/pre_receive_environments/:id/downloads",
            "method": "POST",
            "params": {
                "$id": null
            },
            "description": "Trigger a pre-receive environment download. (In preview period. See README.)"
        },
        
        "get-pre-receive-hook": {
            "url": "/admin/pre-receive-hooks/:id",
            "method": "GET",
            "params": {
                "$id": null
            },
            "description": "Get a single pre-receive hook. (In preview period. See README.)"
        },
        
        "get-pre-receive-hooks": {
            "url": "/admin/pre-receive-hooks",
            "method": "GET",
            "params": {
            },
            "description": "List pre-receive hooks. (In preview period. See README.)"
        },
        
        "create-pre-receive-hook": {
            "url": "/admin/pre-receive-hooks",
            "method": "POST",
            "params": {
                "name": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The name of the hook."
                },
                "script": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The script that the hook runs."
                },
                "script_repository": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The GitHub repository where the script is kept."
                },
                "environment": {
                    "type": "Json",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The pre-receive environment where the script is executed."
                },
                "enforcement": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The state of enforcement for this hook. default: disabled",
                    "default": "disabled"
                },
                "allow_downstream_configuration": {
                    "type": "Boolean",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "Whether enforcement can be overridden at the org or repo level. default: false",
                    "default": "false"
                }
            },
            "description": "Create a pre-receive hook. (In preview period. See README.)"
        },
        
        "edit-pre-receive-hook": {
            "url": "/admin/pre_receive_hooks/:id",
            "method": "PATCH",
            "params": {
                "$id": null,
                "body": {
                    "type": "Json",
                    "sendValueAsBody": true,
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "JSON object that contains pre-receive hook info."
                }
            },
            "description": "Edit a pre-receive hook. (In preview period. See README.)"
        },
        
        "delete-pre-receive-hook": {
            "url": "/admin/pre_receive_hooks/:id",
            "method": "DELETE",
            "params": {
                "$id": null
            },
            "description": "Delete a pre-receive hook. (In preview period. See README.)"
        },

        "queue-indexing-job": {
            "url": "/staff/indexing_jobs",
            "method": "POST",
            "params": {
                "target": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "A string representing the item to index."
                }
            },
            "description": "Queue an indexing job"
        },

        "create-org": {
            "url": "/admin/organizations",
            "method": "POST",
            "params": {
                "login": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The organization's username."
                },
                "admin": {
                    "type": "String",
                    "required": true,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The login of the user who will manage this organization."
                },
                "profile_name": {
                    "type": "String",
                    "required": false,
                    "validation": "",
                    "invalidmsg": "",
                    "description": "The organization's display name."
                }
            },
            "description": "Create an organization"
        }
    }
}

},{}],5:[function(require,module,exports){
/** section: github
 * class Util
 *
 *  Copyright 2012 Cloud9 IDE, Inc.
 *
 *  This product includes software developed by
 *  Cloud9 IDE, Inc (http://c9.io).
 *
 *  Author: Mike de Boer <mike@c9.io>
 **/

var Util = require("util");

/**
 *  Util#extend(dest, src, noOverwrite) -> Object
 *      - dest (Object): destination object
 *      - src (Object): source object
 *      - noOverwrite (Boolean): set to `true` to overwrite values in `src`
 *
 *  Shallow copy of properties from the `src` object to the `dest` object. If the
 *  `noOverwrite` argument is set to to `true`, the value of a property in `src`
 *  will not be overwritten if it already exists.
 **/
exports.extend = function(dest, src, noOverwrite) {
    for (var prop in src) {
        if (!noOverwrite || typeof dest[prop] == "undefined") {
            dest[prop] = src[prop];
        }
    }
    return dest;
};

/**
 *  Util#escapeRegExp(str) -> String
 *      - str (String): string to escape
 *
 *  Escapes characters inside a string that will an error when it is used as part
 *  of a regex upon instantiation like in `new RegExp("[0-9" + str + "]")`
 **/
exports.escapeRegExp = function(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
};

/**
 *  Util#toCamelCase(str, [upper]) -> String
 *      - str (String): string to transform
 *      - upper (Boolean): set to `true` to transform to CamelCase
 *
 *  Transform a string that contains spaces or dashes to camelCase. If `upper` is
 *  set to `true`, the string will be transformed to CamelCase.
 *
 *  Example:
 *
 *      Util.toCamelCase("why U no-work"); // returns 'whyUNoWork'
 *      Util.toCamelCase("I U no-work", true); // returns 'WhyUNoWork'
 **/
exports.toCamelCase = function(str, upper) {
    str = str.toLowerCase().replace(/(?:(^.)|(\s+.)|(-.))/g, function(match) {
        return match.charAt(match.length - 1).toUpperCase();
    });
    if (upper) {
        return str;
    }
    return str.charAt(0).toLowerCase() + str.substr(1);
};

/**
 *  Util#isTrue(c) -> Boolean
 *      - c (mixed): value the variable to check. Possible values:
 *          true   The function returns true.
 *          'true' The function returns true.
 *          'on'   The function returns true.
 *          1      The function returns true.
 *          '1'    The function returns true.
 *
 *  Determines whether a string is true in the html attribute sense.
 **/
exports.isTrue = function(c){
    return (c === true || c === "true" || c === "on" || typeof c == "number" && c > 0 || c === "1");
};

/**
 *  Util#isFalse(c) -> Boolean
 *      - c (mixed): value the variable to check. Possible values:
 *          false   The function returns true.
 *          'false' The function returns true.
 *          'off'   The function returns true.
 *          0       The function returns true.
 *          '0'     The function returns true.
 *
 *  Determines whether a string is false in the html attribute sense.
 **/
exports.isFalse = function(c){
    return (c === false || c === "false" || c === "off" || c === 0 || c === "0");
};

var levels = {
    "info":  ["\u001b[90m", "\u001b[39m"], // grey
    "error": ["\u001b[31m", "\u001b[39m"], // red
    "fatal": ["\u001b[35m", "\u001b[39m"], // magenta
    "exit":  ["\u001b[36m", "\u001b[39m"]  // cyan
};
var _slice = Array.prototype.slice;

/**
 *  Util#log(arg1, [arg2], [type]) -> null
 *      - arg1 (mixed): messages to be printed to the standard output
 *      - type (String): type denotation of the message. Possible values:
 *          'info', 'error', 'fatal', 'exit'. Optional, defaults to 'info'.
 *
 *  Unified logging to the console; arguments passed to this function will put logged
 *  to the standard output of the current process and properly formatted.
 *  Any non-String object will be inspected by the NodeJS util#inspect utility
 *  function.
 *  Messages will be prefixed with its type (with corresponding font color), like so:
 *
 *      [info] informational message
 *      [error] error message
 *      [fatal] fatal error message
 *      [exit] program exit message (not an error)
 *
 * The type of message can be defined by passing it to this function as the last/
 * final argument. If the type can not be found, this last/ final argument will be
 * regarded as yet another message.
 **/
exports.log = function() {
    var args = _slice.call(arguments);
    var lastArg = args[args.length - 1];

    var level = levels[lastArg] ? args.pop() : "info";
    if (!args.length) {
        return;
    }

    var msg = args.map(function(arg) {
        return typeof arg != "string" ? Util.inspect(arg) : arg;
    }).join(" ");
    var pfx = levels[level][0] + "[" + level + "]" + levels[level][1];

    msg.split("\n").forEach(function(line) {
        console.log(pfx + " " + line);
    });
};

},{"util":22}],6:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],7:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT) {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.')
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

},{"base64-js":6,"ieee754":8}],8:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],9:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],10:[function(require,module,exports){
module.exports={
  "application/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "application/3gpdash-qoe-report+xml": {
    "source": "iana"
  },
  "application/3gpp-ims+xml": {
    "source": "iana"
  },
  "application/a2l": {
    "source": "iana"
  },
  "application/activemessage": {
    "source": "iana"
  },
  "application/alto-costmap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-costmapfilter+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-directory+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointcost+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointcostparams+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointprop+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-endpointpropparams+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-error+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-networkmap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/alto-networkmapfilter+json": {
    "source": "iana",
    "compressible": true
  },
  "application/aml": {
    "source": "iana"
  },
  "application/andrew-inset": {
    "source": "iana",
    "extensions": ["ez"]
  },
  "application/applefile": {
    "source": "iana"
  },
  "application/applixware": {
    "source": "apache",
    "extensions": ["aw"]
  },
  "application/atf": {
    "source": "iana"
  },
  "application/atfx": {
    "source": "iana"
  },
  "application/atom+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["atom"]
  },
  "application/atomcat+xml": {
    "source": "iana",
    "extensions": ["atomcat"]
  },
  "application/atomdeleted+xml": {
    "source": "iana"
  },
  "application/atomicmail": {
    "source": "iana"
  },
  "application/atomsvc+xml": {
    "source": "iana",
    "extensions": ["atomsvc"]
  },
  "application/atxml": {
    "source": "iana"
  },
  "application/auth-policy+xml": {
    "source": "iana"
  },
  "application/bacnet-xdd+zip": {
    "source": "iana"
  },
  "application/batch-smtp": {
    "source": "iana"
  },
  "application/bdoc": {
    "compressible": false,
    "extensions": ["bdoc"]
  },
  "application/beep+xml": {
    "source": "iana"
  },
  "application/calendar+json": {
    "source": "iana",
    "compressible": true
  },
  "application/calendar+xml": {
    "source": "iana"
  },
  "application/call-completion": {
    "source": "iana"
  },
  "application/cals-1840": {
    "source": "iana"
  },
  "application/cbor": {
    "source": "iana"
  },
  "application/ccmp+xml": {
    "source": "iana"
  },
  "application/ccxml+xml": {
    "source": "iana",
    "extensions": ["ccxml"]
  },
  "application/cdfx+xml": {
    "source": "iana"
  },
  "application/cdmi-capability": {
    "source": "iana",
    "extensions": ["cdmia"]
  },
  "application/cdmi-container": {
    "source": "iana",
    "extensions": ["cdmic"]
  },
  "application/cdmi-domain": {
    "source": "iana",
    "extensions": ["cdmid"]
  },
  "application/cdmi-object": {
    "source": "iana",
    "extensions": ["cdmio"]
  },
  "application/cdmi-queue": {
    "source": "iana",
    "extensions": ["cdmiq"]
  },
  "application/cdni": {
    "source": "iana"
  },
  "application/cea": {
    "source": "iana"
  },
  "application/cea-2018+xml": {
    "source": "iana"
  },
  "application/cellml+xml": {
    "source": "iana"
  },
  "application/cfw": {
    "source": "iana"
  },
  "application/clue_info+xml": {
    "source": "iana"
  },
  "application/cms": {
    "source": "iana"
  },
  "application/cnrp+xml": {
    "source": "iana"
  },
  "application/coap-group+json": {
    "source": "iana",
    "compressible": true
  },
  "application/commonground": {
    "source": "iana"
  },
  "application/conference-info+xml": {
    "source": "iana"
  },
  "application/cpl+xml": {
    "source": "iana"
  },
  "application/csrattrs": {
    "source": "iana"
  },
  "application/csta+xml": {
    "source": "iana"
  },
  "application/cstadata+xml": {
    "source": "iana"
  },
  "application/csvm+json": {
    "source": "iana",
    "compressible": true
  },
  "application/cu-seeme": {
    "source": "apache",
    "extensions": ["cu"]
  },
  "application/cybercash": {
    "source": "iana"
  },
  "application/dart": {
    "compressible": true
  },
  "application/dash+xml": {
    "source": "iana",
    "extensions": ["mpd"]
  },
  "application/dashdelta": {
    "source": "iana"
  },
  "application/davmount+xml": {
    "source": "iana",
    "extensions": ["davmount"]
  },
  "application/dca-rft": {
    "source": "iana"
  },
  "application/dcd": {
    "source": "iana"
  },
  "application/dec-dx": {
    "source": "iana"
  },
  "application/dialog-info+xml": {
    "source": "iana"
  },
  "application/dicom": {
    "source": "iana"
  },
  "application/dicom+json": {
    "source": "iana",
    "compressible": true
  },
  "application/dicom+xml": {
    "source": "iana"
  },
  "application/dii": {
    "source": "iana"
  },
  "application/dit": {
    "source": "iana"
  },
  "application/dns": {
    "source": "iana"
  },
  "application/docbook+xml": {
    "source": "apache",
    "extensions": ["dbk"]
  },
  "application/dskpp+xml": {
    "source": "iana"
  },
  "application/dssc+der": {
    "source": "iana",
    "extensions": ["dssc"]
  },
  "application/dssc+xml": {
    "source": "iana",
    "extensions": ["xdssc"]
  },
  "application/dvcs": {
    "source": "iana"
  },
  "application/ecmascript": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ecma"]
  },
  "application/edi-consent": {
    "source": "iana"
  },
  "application/edi-x12": {
    "source": "iana",
    "compressible": false
  },
  "application/edifact": {
    "source": "iana",
    "compressible": false
  },
  "application/efi": {
    "source": "iana"
  },
  "application/emergencycalldata.comment+xml": {
    "source": "iana"
  },
  "application/emergencycalldata.deviceinfo+xml": {
    "source": "iana"
  },
  "application/emergencycalldata.providerinfo+xml": {
    "source": "iana"
  },
  "application/emergencycalldata.serviceinfo+xml": {
    "source": "iana"
  },
  "application/emergencycalldata.subscriberinfo+xml": {
    "source": "iana"
  },
  "application/emma+xml": {
    "source": "iana",
    "extensions": ["emma"]
  },
  "application/emotionml+xml": {
    "source": "iana"
  },
  "application/encaprtp": {
    "source": "iana"
  },
  "application/epp+xml": {
    "source": "iana"
  },
  "application/epub+zip": {
    "source": "iana",
    "extensions": ["epub"]
  },
  "application/eshop": {
    "source": "iana"
  },
  "application/exi": {
    "source": "iana",
    "extensions": ["exi"]
  },
  "application/fastinfoset": {
    "source": "iana"
  },
  "application/fastsoap": {
    "source": "iana"
  },
  "application/fdt+xml": {
    "source": "iana"
  },
  "application/fits": {
    "source": "iana"
  },
  "application/font-sfnt": {
    "source": "iana"
  },
  "application/font-tdpfr": {
    "source": "iana",
    "extensions": ["pfr"]
  },
  "application/font-woff": {
    "source": "iana",
    "compressible": false,
    "extensions": ["woff"]
  },
  "application/font-woff2": {
    "compressible": false,
    "extensions": ["woff2"]
  },
  "application/framework-attributes+xml": {
    "source": "iana"
  },
  "application/geo+json": {
    "source": "iana",
    "compressible": true
  },
  "application/gml+xml": {
    "source": "apache",
    "extensions": ["gml"]
  },
  "application/gpx+xml": {
    "source": "apache",
    "extensions": ["gpx"]
  },
  "application/gxf": {
    "source": "apache",
    "extensions": ["gxf"]
  },
  "application/gzip": {
    "source": "iana",
    "compressible": false
  },
  "application/h224": {
    "source": "iana"
  },
  "application/held+xml": {
    "source": "iana"
  },
  "application/http": {
    "source": "iana"
  },
  "application/hyperstudio": {
    "source": "iana",
    "extensions": ["stk"]
  },
  "application/ibe-key-request+xml": {
    "source": "iana"
  },
  "application/ibe-pkg-reply+xml": {
    "source": "iana"
  },
  "application/ibe-pp-data": {
    "source": "iana"
  },
  "application/iges": {
    "source": "iana"
  },
  "application/im-iscomposing+xml": {
    "source": "iana"
  },
  "application/index": {
    "source": "iana"
  },
  "application/index.cmd": {
    "source": "iana"
  },
  "application/index.obj": {
    "source": "iana"
  },
  "application/index.response": {
    "source": "iana"
  },
  "application/index.vnd": {
    "source": "iana"
  },
  "application/inkml+xml": {
    "source": "iana",
    "extensions": ["ink","inkml"]
  },
  "application/iotp": {
    "source": "iana"
  },
  "application/ipfix": {
    "source": "iana",
    "extensions": ["ipfix"]
  },
  "application/ipp": {
    "source": "iana"
  },
  "application/isup": {
    "source": "iana"
  },
  "application/its+xml": {
    "source": "iana"
  },
  "application/java-archive": {
    "source": "apache",
    "compressible": false,
    "extensions": ["jar","war","ear"]
  },
  "application/java-serialized-object": {
    "source": "apache",
    "compressible": false,
    "extensions": ["ser"]
  },
  "application/java-vm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["class"]
  },
  "application/javascript": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["js"]
  },
  "application/jose": {
    "source": "iana"
  },
  "application/jose+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jrd+json": {
    "source": "iana",
    "compressible": true
  },
  "application/json": {
    "source": "iana",
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["json","map"]
  },
  "application/json-patch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/json-seq": {
    "source": "iana"
  },
  "application/json5": {
    "extensions": ["json5"]
  },
  "application/jsonml+json": {
    "source": "apache",
    "compressible": true,
    "extensions": ["jsonml"]
  },
  "application/jwk+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jwk-set+json": {
    "source": "iana",
    "compressible": true
  },
  "application/jwt": {
    "source": "iana"
  },
  "application/kpml-request+xml": {
    "source": "iana"
  },
  "application/kpml-response+xml": {
    "source": "iana"
  },
  "application/ld+json": {
    "source": "iana",
    "compressible": true,
    "extensions": ["jsonld"]
  },
  "application/lgr+xml": {
    "source": "iana"
  },
  "application/link-format": {
    "source": "iana"
  },
  "application/load-control+xml": {
    "source": "iana"
  },
  "application/lost+xml": {
    "source": "iana",
    "extensions": ["lostxml"]
  },
  "application/lostsync+xml": {
    "source": "iana"
  },
  "application/lxf": {
    "source": "iana"
  },
  "application/mac-binhex40": {
    "source": "iana",
    "extensions": ["hqx"]
  },
  "application/mac-compactpro": {
    "source": "apache",
    "extensions": ["cpt"]
  },
  "application/macwriteii": {
    "source": "iana"
  },
  "application/mads+xml": {
    "source": "iana",
    "extensions": ["mads"]
  },
  "application/manifest+json": {
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["webmanifest"]
  },
  "application/marc": {
    "source": "iana",
    "extensions": ["mrc"]
  },
  "application/marcxml+xml": {
    "source": "iana",
    "extensions": ["mrcx"]
  },
  "application/mathematica": {
    "source": "iana",
    "extensions": ["ma","nb","mb"]
  },
  "application/mathml+xml": {
    "source": "iana",
    "extensions": ["mathml"]
  },
  "application/mathml-content+xml": {
    "source": "iana"
  },
  "application/mathml-presentation+xml": {
    "source": "iana"
  },
  "application/mbms-associated-procedure-description+xml": {
    "source": "iana"
  },
  "application/mbms-deregister+xml": {
    "source": "iana"
  },
  "application/mbms-envelope+xml": {
    "source": "iana"
  },
  "application/mbms-msk+xml": {
    "source": "iana"
  },
  "application/mbms-msk-response+xml": {
    "source": "iana"
  },
  "application/mbms-protection-description+xml": {
    "source": "iana"
  },
  "application/mbms-reception-report+xml": {
    "source": "iana"
  },
  "application/mbms-register+xml": {
    "source": "iana"
  },
  "application/mbms-register-response+xml": {
    "source": "iana"
  },
  "application/mbms-schedule+xml": {
    "source": "iana"
  },
  "application/mbms-user-service-description+xml": {
    "source": "iana"
  },
  "application/mbox": {
    "source": "iana",
    "extensions": ["mbox"]
  },
  "application/media-policy-dataset+xml": {
    "source": "iana"
  },
  "application/media_control+xml": {
    "source": "iana"
  },
  "application/mediaservercontrol+xml": {
    "source": "iana",
    "extensions": ["mscml"]
  },
  "application/merge-patch+json": {
    "source": "iana",
    "compressible": true
  },
  "application/metalink+xml": {
    "source": "apache",
    "extensions": ["metalink"]
  },
  "application/metalink4+xml": {
    "source": "iana",
    "extensions": ["meta4"]
  },
  "application/mets+xml": {
    "source": "iana",
    "extensions": ["mets"]
  },
  "application/mf4": {
    "source": "iana"
  },
  "application/mikey": {
    "source": "iana"
  },
  "application/mods+xml": {
    "source": "iana",
    "extensions": ["mods"]
  },
  "application/moss-keys": {
    "source": "iana"
  },
  "application/moss-signature": {
    "source": "iana"
  },
  "application/mosskey-data": {
    "source": "iana"
  },
  "application/mosskey-request": {
    "source": "iana"
  },
  "application/mp21": {
    "source": "iana",
    "extensions": ["m21","mp21"]
  },
  "application/mp4": {
    "source": "iana",
    "extensions": ["mp4s","m4p"]
  },
  "application/mpeg4-generic": {
    "source": "iana"
  },
  "application/mpeg4-iod": {
    "source": "iana"
  },
  "application/mpeg4-iod-xmt": {
    "source": "iana"
  },
  "application/mrb-consumer+xml": {
    "source": "iana"
  },
  "application/mrb-publish+xml": {
    "source": "iana"
  },
  "application/msc-ivr+xml": {
    "source": "iana"
  },
  "application/msc-mixer+xml": {
    "source": "iana"
  },
  "application/msword": {
    "source": "iana",
    "compressible": false,
    "extensions": ["doc","dot"]
  },
  "application/mxf": {
    "source": "iana",
    "extensions": ["mxf"]
  },
  "application/nasdata": {
    "source": "iana"
  },
  "application/news-checkgroups": {
    "source": "iana"
  },
  "application/news-groupinfo": {
    "source": "iana"
  },
  "application/news-transmission": {
    "source": "iana"
  },
  "application/nlsml+xml": {
    "source": "iana"
  },
  "application/nss": {
    "source": "iana"
  },
  "application/ocsp-request": {
    "source": "iana"
  },
  "application/ocsp-response": {
    "source": "iana"
  },
  "application/octet-stream": {
    "source": "iana",
    "compressible": false,
    "extensions": ["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","exe","dll","deb","dmg","iso","img","msi","msp","msm","buffer"]
  },
  "application/oda": {
    "source": "iana",
    "extensions": ["oda"]
  },
  "application/odx": {
    "source": "iana"
  },
  "application/oebps-package+xml": {
    "source": "iana",
    "extensions": ["opf"]
  },
  "application/ogg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ogx"]
  },
  "application/omdoc+xml": {
    "source": "apache",
    "extensions": ["omdoc"]
  },
  "application/onenote": {
    "source": "apache",
    "extensions": ["onetoc","onetoc2","onetmp","onepkg"]
  },
  "application/oxps": {
    "source": "iana",
    "extensions": ["oxps"]
  },
  "application/p2p-overlay+xml": {
    "source": "iana"
  },
  "application/parityfec": {
    "source": "iana"
  },
  "application/patch-ops-error+xml": {
    "source": "iana",
    "extensions": ["xer"]
  },
  "application/pdf": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pdf"]
  },
  "application/pdx": {
    "source": "iana"
  },
  "application/pgp-encrypted": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pgp"]
  },
  "application/pgp-keys": {
    "source": "iana"
  },
  "application/pgp-signature": {
    "source": "iana",
    "extensions": ["asc","sig"]
  },
  "application/pics-rules": {
    "source": "apache",
    "extensions": ["prf"]
  },
  "application/pidf+xml": {
    "source": "iana"
  },
  "application/pidf-diff+xml": {
    "source": "iana"
  },
  "application/pkcs10": {
    "source": "iana",
    "extensions": ["p10"]
  },
  "application/pkcs12": {
    "source": "iana"
  },
  "application/pkcs7-mime": {
    "source": "iana",
    "extensions": ["p7m","p7c"]
  },
  "application/pkcs7-signature": {
    "source": "iana",
    "extensions": ["p7s"]
  },
  "application/pkcs8": {
    "source": "iana",
    "extensions": ["p8"]
  },
  "application/pkix-attr-cert": {
    "source": "iana",
    "extensions": ["ac"]
  },
  "application/pkix-cert": {
    "source": "iana",
    "extensions": ["cer"]
  },
  "application/pkix-crl": {
    "source": "iana",
    "extensions": ["crl"]
  },
  "application/pkix-pkipath": {
    "source": "iana",
    "extensions": ["pkipath"]
  },
  "application/pkixcmp": {
    "source": "iana",
    "extensions": ["pki"]
  },
  "application/pls+xml": {
    "source": "iana",
    "extensions": ["pls"]
  },
  "application/poc-settings+xml": {
    "source": "iana"
  },
  "application/postscript": {
    "source": "iana",
    "compressible": true,
    "extensions": ["ai","eps","ps"]
  },
  "application/ppsp-tracker+json": {
    "source": "iana",
    "compressible": true
  },
  "application/problem+json": {
    "source": "iana",
    "compressible": true
  },
  "application/problem+xml": {
    "source": "iana"
  },
  "application/provenance+xml": {
    "source": "iana"
  },
  "application/prs.alvestrand.titrax-sheet": {
    "source": "iana"
  },
  "application/prs.cww": {
    "source": "iana",
    "extensions": ["cww"]
  },
  "application/prs.hpub+zip": {
    "source": "iana"
  },
  "application/prs.nprend": {
    "source": "iana"
  },
  "application/prs.plucker": {
    "source": "iana"
  },
  "application/prs.rdf-xml-crypt": {
    "source": "iana"
  },
  "application/prs.xsf+xml": {
    "source": "iana"
  },
  "application/pskc+xml": {
    "source": "iana",
    "extensions": ["pskcxml"]
  },
  "application/qsig": {
    "source": "iana"
  },
  "application/raptorfec": {
    "source": "iana"
  },
  "application/rdap+json": {
    "source": "iana",
    "compressible": true
  },
  "application/rdf+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rdf"]
  },
  "application/reginfo+xml": {
    "source": "iana",
    "extensions": ["rif"]
  },
  "application/relax-ng-compact-syntax": {
    "source": "iana",
    "extensions": ["rnc"]
  },
  "application/remote-printing": {
    "source": "iana"
  },
  "application/reputon+json": {
    "source": "iana",
    "compressible": true
  },
  "application/resource-lists+xml": {
    "source": "iana",
    "extensions": ["rl"]
  },
  "application/resource-lists-diff+xml": {
    "source": "iana",
    "extensions": ["rld"]
  },
  "application/rfc+xml": {
    "source": "iana"
  },
  "application/riscos": {
    "source": "iana"
  },
  "application/rlmi+xml": {
    "source": "iana"
  },
  "application/rls-services+xml": {
    "source": "iana",
    "extensions": ["rs"]
  },
  "application/rpki-ghostbusters": {
    "source": "iana",
    "extensions": ["gbr"]
  },
  "application/rpki-manifest": {
    "source": "iana",
    "extensions": ["mft"]
  },
  "application/rpki-roa": {
    "source": "iana",
    "extensions": ["roa"]
  },
  "application/rpki-updown": {
    "source": "iana"
  },
  "application/rsd+xml": {
    "source": "apache",
    "extensions": ["rsd"]
  },
  "application/rss+xml": {
    "source": "apache",
    "compressible": true,
    "extensions": ["rss"]
  },
  "application/rtf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtf"]
  },
  "application/rtploopback": {
    "source": "iana"
  },
  "application/rtx": {
    "source": "iana"
  },
  "application/samlassertion+xml": {
    "source": "iana"
  },
  "application/samlmetadata+xml": {
    "source": "iana"
  },
  "application/sbml+xml": {
    "source": "iana",
    "extensions": ["sbml"]
  },
  "application/scaip+xml": {
    "source": "iana"
  },
  "application/scim+json": {
    "source": "iana",
    "compressible": true
  },
  "application/scvp-cv-request": {
    "source": "iana",
    "extensions": ["scq"]
  },
  "application/scvp-cv-response": {
    "source": "iana",
    "extensions": ["scs"]
  },
  "application/scvp-vp-request": {
    "source": "iana",
    "extensions": ["spq"]
  },
  "application/scvp-vp-response": {
    "source": "iana",
    "extensions": ["spp"]
  },
  "application/sdp": {
    "source": "iana",
    "extensions": ["sdp"]
  },
  "application/sep+xml": {
    "source": "iana"
  },
  "application/sep-exi": {
    "source": "iana"
  },
  "application/session-info": {
    "source": "iana"
  },
  "application/set-payment": {
    "source": "iana"
  },
  "application/set-payment-initiation": {
    "source": "iana",
    "extensions": ["setpay"]
  },
  "application/set-registration": {
    "source": "iana"
  },
  "application/set-registration-initiation": {
    "source": "iana",
    "extensions": ["setreg"]
  },
  "application/sgml": {
    "source": "iana"
  },
  "application/sgml-open-catalog": {
    "source": "iana"
  },
  "application/shf+xml": {
    "source": "iana",
    "extensions": ["shf"]
  },
  "application/sieve": {
    "source": "iana"
  },
  "application/simple-filter+xml": {
    "source": "iana"
  },
  "application/simple-message-summary": {
    "source": "iana"
  },
  "application/simplesymbolcontainer": {
    "source": "iana"
  },
  "application/slate": {
    "source": "iana"
  },
  "application/smil": {
    "source": "iana"
  },
  "application/smil+xml": {
    "source": "iana",
    "extensions": ["smi","smil"]
  },
  "application/smpte336m": {
    "source": "iana"
  },
  "application/soap+fastinfoset": {
    "source": "iana"
  },
  "application/soap+xml": {
    "source": "iana",
    "compressible": true
  },
  "application/sparql-query": {
    "source": "iana",
    "extensions": ["rq"]
  },
  "application/sparql-results+xml": {
    "source": "iana",
    "extensions": ["srx"]
  },
  "application/spirits-event+xml": {
    "source": "iana"
  },
  "application/sql": {
    "source": "iana"
  },
  "application/srgs": {
    "source": "iana",
    "extensions": ["gram"]
  },
  "application/srgs+xml": {
    "source": "iana",
    "extensions": ["grxml"]
  },
  "application/sru+xml": {
    "source": "iana",
    "extensions": ["sru"]
  },
  "application/ssdl+xml": {
    "source": "apache",
    "extensions": ["ssdl"]
  },
  "application/ssml+xml": {
    "source": "iana",
    "extensions": ["ssml"]
  },
  "application/tamp-apex-update": {
    "source": "iana"
  },
  "application/tamp-apex-update-confirm": {
    "source": "iana"
  },
  "application/tamp-community-update": {
    "source": "iana"
  },
  "application/tamp-community-update-confirm": {
    "source": "iana"
  },
  "application/tamp-error": {
    "source": "iana"
  },
  "application/tamp-sequence-adjust": {
    "source": "iana"
  },
  "application/tamp-sequence-adjust-confirm": {
    "source": "iana"
  },
  "application/tamp-status-query": {
    "source": "iana"
  },
  "application/tamp-status-response": {
    "source": "iana"
  },
  "application/tamp-update": {
    "source": "iana"
  },
  "application/tamp-update-confirm": {
    "source": "iana"
  },
  "application/tar": {
    "compressible": true
  },
  "application/tei+xml": {
    "source": "iana",
    "extensions": ["tei","teicorpus"]
  },
  "application/thraud+xml": {
    "source": "iana",
    "extensions": ["tfi"]
  },
  "application/timestamp-query": {
    "source": "iana"
  },
  "application/timestamp-reply": {
    "source": "iana"
  },
  "application/timestamped-data": {
    "source": "iana",
    "extensions": ["tsd"]
  },
  "application/ttml+xml": {
    "source": "iana"
  },
  "application/tve-trigger": {
    "source": "iana"
  },
  "application/ulpfec": {
    "source": "iana"
  },
  "application/urc-grpsheet+xml": {
    "source": "iana"
  },
  "application/urc-ressheet+xml": {
    "source": "iana"
  },
  "application/urc-targetdesc+xml": {
    "source": "iana"
  },
  "application/urc-uisocketdesc+xml": {
    "source": "iana"
  },
  "application/vcard+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vcard+xml": {
    "source": "iana"
  },
  "application/vemmi": {
    "source": "iana"
  },
  "application/vividence.scriptfile": {
    "source": "apache"
  },
  "application/vnd.3gpp-prose+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp-prose-pc3ch+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.access-transfer-events+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.bsf+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.mid-call+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.pic-bw-large": {
    "source": "iana",
    "extensions": ["plb"]
  },
  "application/vnd.3gpp.pic-bw-small": {
    "source": "iana",
    "extensions": ["psb"]
  },
  "application/vnd.3gpp.pic-bw-var": {
    "source": "iana",
    "extensions": ["pvb"]
  },
  "application/vnd.3gpp.sms": {
    "source": "iana"
  },
  "application/vnd.3gpp.sms+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.srvcc-ext+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.srvcc-info+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.state-and-event-info+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp.ussd+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp2.bcmcsinfo+xml": {
    "source": "iana"
  },
  "application/vnd.3gpp2.sms": {
    "source": "iana"
  },
  "application/vnd.3gpp2.tcap": {
    "source": "iana",
    "extensions": ["tcap"]
  },
  "application/vnd.3lightssoftware.imagescal": {
    "source": "iana"
  },
  "application/vnd.3m.post-it-notes": {
    "source": "iana",
    "extensions": ["pwn"]
  },
  "application/vnd.accpac.simply.aso": {
    "source": "iana",
    "extensions": ["aso"]
  },
  "application/vnd.accpac.simply.imp": {
    "source": "iana",
    "extensions": ["imp"]
  },
  "application/vnd.acucobol": {
    "source": "iana",
    "extensions": ["acu"]
  },
  "application/vnd.acucorp": {
    "source": "iana",
    "extensions": ["atc","acutc"]
  },
  "application/vnd.adobe.air-application-installer-package+zip": {
    "source": "apache",
    "extensions": ["air"]
  },
  "application/vnd.adobe.flash.movie": {
    "source": "iana"
  },
  "application/vnd.adobe.formscentral.fcdt": {
    "source": "iana",
    "extensions": ["fcdt"]
  },
  "application/vnd.adobe.fxp": {
    "source": "iana",
    "extensions": ["fxp","fxpl"]
  },
  "application/vnd.adobe.partial-upload": {
    "source": "iana"
  },
  "application/vnd.adobe.xdp+xml": {
    "source": "iana",
    "extensions": ["xdp"]
  },
  "application/vnd.adobe.xfdf": {
    "source": "iana",
    "extensions": ["xfdf"]
  },
  "application/vnd.aether.imp": {
    "source": "iana"
  },
  "application/vnd.ah-barcode": {
    "source": "iana"
  },
  "application/vnd.ahead.space": {
    "source": "iana",
    "extensions": ["ahead"]
  },
  "application/vnd.airzip.filesecure.azf": {
    "source": "iana",
    "extensions": ["azf"]
  },
  "application/vnd.airzip.filesecure.azs": {
    "source": "iana",
    "extensions": ["azs"]
  },
  "application/vnd.amazon.ebook": {
    "source": "apache",
    "extensions": ["azw"]
  },
  "application/vnd.amazon.mobi8-ebook": {
    "source": "iana"
  },
  "application/vnd.americandynamics.acc": {
    "source": "iana",
    "extensions": ["acc"]
  },
  "application/vnd.amiga.ami": {
    "source": "iana",
    "extensions": ["ami"]
  },
  "application/vnd.amundsen.maze+xml": {
    "source": "iana"
  },
  "application/vnd.android.package-archive": {
    "source": "apache",
    "compressible": false,
    "extensions": ["apk"]
  },
  "application/vnd.anki": {
    "source": "iana"
  },
  "application/vnd.anser-web-certificate-issue-initiation": {
    "source": "iana",
    "extensions": ["cii"]
  },
  "application/vnd.anser-web-funds-transfer-initiation": {
    "source": "apache",
    "extensions": ["fti"]
  },
  "application/vnd.antix.game-component": {
    "source": "iana",
    "extensions": ["atx"]
  },
  "application/vnd.apache.thrift.binary": {
    "source": "iana"
  },
  "application/vnd.apache.thrift.compact": {
    "source": "iana"
  },
  "application/vnd.apache.thrift.json": {
    "source": "iana"
  },
  "application/vnd.api+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.apple.installer+xml": {
    "source": "iana",
    "extensions": ["mpkg"]
  },
  "application/vnd.apple.mpegurl": {
    "source": "iana",
    "extensions": ["m3u8"]
  },
  "application/vnd.apple.pkpass": {
    "compressible": false,
    "extensions": ["pkpass"]
  },
  "application/vnd.arastra.swi": {
    "source": "iana"
  },
  "application/vnd.aristanetworks.swi": {
    "source": "iana",
    "extensions": ["swi"]
  },
  "application/vnd.artsquare": {
    "source": "iana"
  },
  "application/vnd.astraea-software.iota": {
    "source": "iana",
    "extensions": ["iota"]
  },
  "application/vnd.audiograph": {
    "source": "iana",
    "extensions": ["aep"]
  },
  "application/vnd.autopackage": {
    "source": "iana"
  },
  "application/vnd.avistar+xml": {
    "source": "iana"
  },
  "application/vnd.balsamiq.bmml+xml": {
    "source": "iana"
  },
  "application/vnd.balsamiq.bmpr": {
    "source": "iana"
  },
  "application/vnd.bekitzur-stech+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.biopax.rdf+xml": {
    "source": "iana"
  },
  "application/vnd.blueice.multipass": {
    "source": "iana",
    "extensions": ["mpm"]
  },
  "application/vnd.bluetooth.ep.oob": {
    "source": "iana"
  },
  "application/vnd.bluetooth.le.oob": {
    "source": "iana"
  },
  "application/vnd.bmi": {
    "source": "iana",
    "extensions": ["bmi"]
  },
  "application/vnd.businessobjects": {
    "source": "iana",
    "extensions": ["rep"]
  },
  "application/vnd.cab-jscript": {
    "source": "iana"
  },
  "application/vnd.canon-cpdl": {
    "source": "iana"
  },
  "application/vnd.canon-lips": {
    "source": "iana"
  },
  "application/vnd.cendio.thinlinc.clientconf": {
    "source": "iana"
  },
  "application/vnd.century-systems.tcp_stream": {
    "source": "iana"
  },
  "application/vnd.chemdraw+xml": {
    "source": "iana",
    "extensions": ["cdxml"]
  },
  "application/vnd.chess-pgn": {
    "source": "iana"
  },
  "application/vnd.chipnuts.karaoke-mmd": {
    "source": "iana",
    "extensions": ["mmd"]
  },
  "application/vnd.cinderella": {
    "source": "iana",
    "extensions": ["cdy"]
  },
  "application/vnd.cirpack.isdn-ext": {
    "source": "iana"
  },
  "application/vnd.citationstyles.style+xml": {
    "source": "iana"
  },
  "application/vnd.claymore": {
    "source": "iana",
    "extensions": ["cla"]
  },
  "application/vnd.cloanto.rp9": {
    "source": "iana",
    "extensions": ["rp9"]
  },
  "application/vnd.clonk.c4group": {
    "source": "iana",
    "extensions": ["c4g","c4d","c4f","c4p","c4u"]
  },
  "application/vnd.cluetrust.cartomobile-config": {
    "source": "iana",
    "extensions": ["c11amc"]
  },
  "application/vnd.cluetrust.cartomobile-config-pkg": {
    "source": "iana",
    "extensions": ["c11amz"]
  },
  "application/vnd.coffeescript": {
    "source": "iana"
  },
  "application/vnd.collection+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.collection.doc+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.collection.next+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.comicbook+zip": {
    "source": "iana"
  },
  "application/vnd.commerce-battelle": {
    "source": "iana"
  },
  "application/vnd.commonspace": {
    "source": "iana",
    "extensions": ["csp"]
  },
  "application/vnd.contact.cmsg": {
    "source": "iana",
    "extensions": ["cdbcmsg"]
  },
  "application/vnd.coreos.ignition+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.cosmocaller": {
    "source": "iana",
    "extensions": ["cmc"]
  },
  "application/vnd.crick.clicker": {
    "source": "iana",
    "extensions": ["clkx"]
  },
  "application/vnd.crick.clicker.keyboard": {
    "source": "iana",
    "extensions": ["clkk"]
  },
  "application/vnd.crick.clicker.palette": {
    "source": "iana",
    "extensions": ["clkp"]
  },
  "application/vnd.crick.clicker.template": {
    "source": "iana",
    "extensions": ["clkt"]
  },
  "application/vnd.crick.clicker.wordbank": {
    "source": "iana",
    "extensions": ["clkw"]
  },
  "application/vnd.criticaltools.wbs+xml": {
    "source": "iana",
    "extensions": ["wbs"]
  },
  "application/vnd.ctc-posml": {
    "source": "iana",
    "extensions": ["pml"]
  },
  "application/vnd.ctct.ws+xml": {
    "source": "iana"
  },
  "application/vnd.cups-pdf": {
    "source": "iana"
  },
  "application/vnd.cups-postscript": {
    "source": "iana"
  },
  "application/vnd.cups-ppd": {
    "source": "iana",
    "extensions": ["ppd"]
  },
  "application/vnd.cups-raster": {
    "source": "iana"
  },
  "application/vnd.cups-raw": {
    "source": "iana"
  },
  "application/vnd.curl": {
    "source": "iana"
  },
  "application/vnd.curl.car": {
    "source": "apache",
    "extensions": ["car"]
  },
  "application/vnd.curl.pcurl": {
    "source": "apache",
    "extensions": ["pcurl"]
  },
  "application/vnd.cyan.dean.root+xml": {
    "source": "iana"
  },
  "application/vnd.cybank": {
    "source": "iana"
  },
  "application/vnd.d2l.coursepackage1p0+zip": {
    "source": "iana"
  },
  "application/vnd.dart": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dart"]
  },
  "application/vnd.data-vision.rdz": {
    "source": "iana",
    "extensions": ["rdz"]
  },
  "application/vnd.debian.binary-package": {
    "source": "iana"
  },
  "application/vnd.dece.data": {
    "source": "iana",
    "extensions": ["uvf","uvvf","uvd","uvvd"]
  },
  "application/vnd.dece.ttml+xml": {
    "source": "iana",
    "extensions": ["uvt","uvvt"]
  },
  "application/vnd.dece.unspecified": {
    "source": "iana",
    "extensions": ["uvx","uvvx"]
  },
  "application/vnd.dece.zip": {
    "source": "iana",
    "extensions": ["uvz","uvvz"]
  },
  "application/vnd.denovo.fcselayout-link": {
    "source": "iana",
    "extensions": ["fe_launch"]
  },
  "application/vnd.desmume-movie": {
    "source": "iana"
  },
  "application/vnd.desmume.movie": {
    "source": "apache"
  },
  "application/vnd.dir-bi.plate-dl-nosuffix": {
    "source": "iana"
  },
  "application/vnd.dm.delegation+xml": {
    "source": "iana"
  },
  "application/vnd.dna": {
    "source": "iana",
    "extensions": ["dna"]
  },
  "application/vnd.document+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.dolby.mlp": {
    "source": "apache",
    "extensions": ["mlp"]
  },
  "application/vnd.dolby.mobile.1": {
    "source": "iana"
  },
  "application/vnd.dolby.mobile.2": {
    "source": "iana"
  },
  "application/vnd.doremir.scorecloud-binary-document": {
    "source": "iana"
  },
  "application/vnd.dpgraph": {
    "source": "iana",
    "extensions": ["dpg"]
  },
  "application/vnd.dreamfactory": {
    "source": "iana",
    "extensions": ["dfac"]
  },
  "application/vnd.drive+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ds-keypoint": {
    "source": "apache",
    "extensions": ["kpxx"]
  },
  "application/vnd.dtg.local": {
    "source": "iana"
  },
  "application/vnd.dtg.local.flash": {
    "source": "iana"
  },
  "application/vnd.dtg.local.html": {
    "source": "iana"
  },
  "application/vnd.dvb.ait": {
    "source": "iana",
    "extensions": ["ait"]
  },
  "application/vnd.dvb.dvbj": {
    "source": "iana"
  },
  "application/vnd.dvb.esgcontainer": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcdftnotifaccess": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgaccess": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgaccess2": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcesgpdd": {
    "source": "iana"
  },
  "application/vnd.dvb.ipdcroaming": {
    "source": "iana"
  },
  "application/vnd.dvb.iptv.alfec-base": {
    "source": "iana"
  },
  "application/vnd.dvb.iptv.alfec-enhancement": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-aggregate-root+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-container+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-generic+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-ia-msglist+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-ia-registration-request+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-ia-registration-response+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.notif-init+xml": {
    "source": "iana"
  },
  "application/vnd.dvb.pfr": {
    "source": "iana"
  },
  "application/vnd.dvb.service": {
    "source": "iana",
    "extensions": ["svc"]
  },
  "application/vnd.dxr": {
    "source": "iana"
  },
  "application/vnd.dynageo": {
    "source": "iana",
    "extensions": ["geo"]
  },
  "application/vnd.dzr": {
    "source": "iana"
  },
  "application/vnd.easykaraoke.cdgdownload": {
    "source": "iana"
  },
  "application/vnd.ecdis-update": {
    "source": "iana"
  },
  "application/vnd.ecowin.chart": {
    "source": "iana",
    "extensions": ["mag"]
  },
  "application/vnd.ecowin.filerequest": {
    "source": "iana"
  },
  "application/vnd.ecowin.fileupdate": {
    "source": "iana"
  },
  "application/vnd.ecowin.series": {
    "source": "iana"
  },
  "application/vnd.ecowin.seriesrequest": {
    "source": "iana"
  },
  "application/vnd.ecowin.seriesupdate": {
    "source": "iana"
  },
  "application/vnd.emclient.accessrequest+xml": {
    "source": "iana"
  },
  "application/vnd.enliven": {
    "source": "iana",
    "extensions": ["nml"]
  },
  "application/vnd.enphase.envoy": {
    "source": "iana"
  },
  "application/vnd.eprints.data+xml": {
    "source": "iana"
  },
  "application/vnd.epson.esf": {
    "source": "iana",
    "extensions": ["esf"]
  },
  "application/vnd.epson.msf": {
    "source": "iana",
    "extensions": ["msf"]
  },
  "application/vnd.epson.quickanime": {
    "source": "iana",
    "extensions": ["qam"]
  },
  "application/vnd.epson.salt": {
    "source": "iana",
    "extensions": ["slt"]
  },
  "application/vnd.epson.ssf": {
    "source": "iana",
    "extensions": ["ssf"]
  },
  "application/vnd.ericsson.quickcall": {
    "source": "iana"
  },
  "application/vnd.espass-espass+zip": {
    "source": "iana"
  },
  "application/vnd.eszigno3+xml": {
    "source": "iana",
    "extensions": ["es3","et3"]
  },
  "application/vnd.etsi.aoc+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.asic-e+zip": {
    "source": "iana"
  },
  "application/vnd.etsi.asic-s+zip": {
    "source": "iana"
  },
  "application/vnd.etsi.cug+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvcommand+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvdiscovery+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvprofile+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvsad-bc+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvsad-cod+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvsad-npvr+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvservice+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvsync+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.iptvueprofile+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.mcid+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.mheg5": {
    "source": "iana"
  },
  "application/vnd.etsi.overload-control-policy-dataset+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.pstn+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.sci+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.simservs+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.timestamp-token": {
    "source": "iana"
  },
  "application/vnd.etsi.tsl+xml": {
    "source": "iana"
  },
  "application/vnd.etsi.tsl.der": {
    "source": "iana"
  },
  "application/vnd.eudora.data": {
    "source": "iana"
  },
  "application/vnd.ezpix-album": {
    "source": "iana",
    "extensions": ["ez2"]
  },
  "application/vnd.ezpix-package": {
    "source": "iana",
    "extensions": ["ez3"]
  },
  "application/vnd.f-secure.mobile": {
    "source": "iana"
  },
  "application/vnd.fastcopy-disk-image": {
    "source": "iana"
  },
  "application/vnd.fdf": {
    "source": "iana",
    "extensions": ["fdf"]
  },
  "application/vnd.fdsn.mseed": {
    "source": "iana",
    "extensions": ["mseed"]
  },
  "application/vnd.fdsn.seed": {
    "source": "iana",
    "extensions": ["seed","dataless"]
  },
  "application/vnd.ffsns": {
    "source": "iana"
  },
  "application/vnd.filmit.zfc": {
    "source": "iana"
  },
  "application/vnd.fints": {
    "source": "iana"
  },
  "application/vnd.firemonkeys.cloudcell": {
    "source": "iana"
  },
  "application/vnd.flographit": {
    "source": "iana",
    "extensions": ["gph"]
  },
  "application/vnd.fluxtime.clip": {
    "source": "iana",
    "extensions": ["ftc"]
  },
  "application/vnd.font-fontforge-sfd": {
    "source": "iana"
  },
  "application/vnd.framemaker": {
    "source": "iana",
    "extensions": ["fm","frame","maker","book"]
  },
  "application/vnd.frogans.fnc": {
    "source": "iana",
    "extensions": ["fnc"]
  },
  "application/vnd.frogans.ltf": {
    "source": "iana",
    "extensions": ["ltf"]
  },
  "application/vnd.fsc.weblaunch": {
    "source": "iana",
    "extensions": ["fsc"]
  },
  "application/vnd.fujitsu.oasys": {
    "source": "iana",
    "extensions": ["oas"]
  },
  "application/vnd.fujitsu.oasys2": {
    "source": "iana",
    "extensions": ["oa2"]
  },
  "application/vnd.fujitsu.oasys3": {
    "source": "iana",
    "extensions": ["oa3"]
  },
  "application/vnd.fujitsu.oasysgp": {
    "source": "iana",
    "extensions": ["fg5"]
  },
  "application/vnd.fujitsu.oasysprs": {
    "source": "iana",
    "extensions": ["bh2"]
  },
  "application/vnd.fujixerox.art-ex": {
    "source": "iana"
  },
  "application/vnd.fujixerox.art4": {
    "source": "iana"
  },
  "application/vnd.fujixerox.ddd": {
    "source": "iana",
    "extensions": ["ddd"]
  },
  "application/vnd.fujixerox.docuworks": {
    "source": "iana",
    "extensions": ["xdw"]
  },
  "application/vnd.fujixerox.docuworks.binder": {
    "source": "iana",
    "extensions": ["xbd"]
  },
  "application/vnd.fujixerox.docuworks.container": {
    "source": "iana"
  },
  "application/vnd.fujixerox.hbpl": {
    "source": "iana"
  },
  "application/vnd.fut-misnet": {
    "source": "iana"
  },
  "application/vnd.fuzzysheet": {
    "source": "iana",
    "extensions": ["fzs"]
  },
  "application/vnd.genomatix.tuxedo": {
    "source": "iana",
    "extensions": ["txd"]
  },
  "application/vnd.geo+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.geocube+xml": {
    "source": "iana"
  },
  "application/vnd.geogebra.file": {
    "source": "iana",
    "extensions": ["ggb"]
  },
  "application/vnd.geogebra.tool": {
    "source": "iana",
    "extensions": ["ggt"]
  },
  "application/vnd.geometry-explorer": {
    "source": "iana",
    "extensions": ["gex","gre"]
  },
  "application/vnd.geonext": {
    "source": "iana",
    "extensions": ["gxt"]
  },
  "application/vnd.geoplan": {
    "source": "iana",
    "extensions": ["g2w"]
  },
  "application/vnd.geospace": {
    "source": "iana",
    "extensions": ["g3w"]
  },
  "application/vnd.gerber": {
    "source": "iana"
  },
  "application/vnd.globalplatform.card-content-mgt": {
    "source": "iana"
  },
  "application/vnd.globalplatform.card-content-mgt-response": {
    "source": "iana"
  },
  "application/vnd.gmx": {
    "source": "iana",
    "extensions": ["gmx"]
  },
  "application/vnd.google-apps.document": {
    "compressible": false,
    "extensions": ["gdoc"]
  },
  "application/vnd.google-apps.presentation": {
    "compressible": false,
    "extensions": ["gslides"]
  },
  "application/vnd.google-apps.spreadsheet": {
    "compressible": false,
    "extensions": ["gsheet"]
  },
  "application/vnd.google-earth.kml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["kml"]
  },
  "application/vnd.google-earth.kmz": {
    "source": "iana",
    "compressible": false,
    "extensions": ["kmz"]
  },
  "application/vnd.gov.sk.e-form+xml": {
    "source": "iana"
  },
  "application/vnd.gov.sk.e-form+zip": {
    "source": "iana"
  },
  "application/vnd.gov.sk.xmldatacontainer+xml": {
    "source": "iana"
  },
  "application/vnd.grafeq": {
    "source": "iana",
    "extensions": ["gqf","gqs"]
  },
  "application/vnd.gridmp": {
    "source": "iana"
  },
  "application/vnd.groove-account": {
    "source": "iana",
    "extensions": ["gac"]
  },
  "application/vnd.groove-help": {
    "source": "iana",
    "extensions": ["ghf"]
  },
  "application/vnd.groove-identity-message": {
    "source": "iana",
    "extensions": ["gim"]
  },
  "application/vnd.groove-injector": {
    "source": "iana",
    "extensions": ["grv"]
  },
  "application/vnd.groove-tool-message": {
    "source": "iana",
    "extensions": ["gtm"]
  },
  "application/vnd.groove-tool-template": {
    "source": "iana",
    "extensions": ["tpl"]
  },
  "application/vnd.groove-vcard": {
    "source": "iana",
    "extensions": ["vcg"]
  },
  "application/vnd.hal+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hal+xml": {
    "source": "iana",
    "extensions": ["hal"]
  },
  "application/vnd.handheld-entertainment+xml": {
    "source": "iana",
    "extensions": ["zmm"]
  },
  "application/vnd.hbci": {
    "source": "iana",
    "extensions": ["hbci"]
  },
  "application/vnd.hcl-bireports": {
    "source": "iana"
  },
  "application/vnd.hdt": {
    "source": "iana"
  },
  "application/vnd.heroku+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hhe.lesson-player": {
    "source": "iana",
    "extensions": ["les"]
  },
  "application/vnd.hp-hpgl": {
    "source": "iana",
    "extensions": ["hpgl"]
  },
  "application/vnd.hp-hpid": {
    "source": "iana",
    "extensions": ["hpid"]
  },
  "application/vnd.hp-hps": {
    "source": "iana",
    "extensions": ["hps"]
  },
  "application/vnd.hp-jlyt": {
    "source": "iana",
    "extensions": ["jlt"]
  },
  "application/vnd.hp-pcl": {
    "source": "iana",
    "extensions": ["pcl"]
  },
  "application/vnd.hp-pclxl": {
    "source": "iana",
    "extensions": ["pclxl"]
  },
  "application/vnd.httphone": {
    "source": "iana"
  },
  "application/vnd.hydrostatix.sof-data": {
    "source": "iana",
    "extensions": ["sfd-hdstx"]
  },
  "application/vnd.hyperdrive+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.hzn-3d-crossword": {
    "source": "iana"
  },
  "application/vnd.ibm.afplinedata": {
    "source": "iana"
  },
  "application/vnd.ibm.electronic-media": {
    "source": "iana"
  },
  "application/vnd.ibm.minipay": {
    "source": "iana",
    "extensions": ["mpy"]
  },
  "application/vnd.ibm.modcap": {
    "source": "iana",
    "extensions": ["afp","listafp","list3820"]
  },
  "application/vnd.ibm.rights-management": {
    "source": "iana",
    "extensions": ["irm"]
  },
  "application/vnd.ibm.secure-container": {
    "source": "iana",
    "extensions": ["sc"]
  },
  "application/vnd.iccprofile": {
    "source": "iana",
    "extensions": ["icc","icm"]
  },
  "application/vnd.ieee.1905": {
    "source": "iana"
  },
  "application/vnd.igloader": {
    "source": "iana",
    "extensions": ["igl"]
  },
  "application/vnd.immervision-ivp": {
    "source": "iana",
    "extensions": ["ivp"]
  },
  "application/vnd.immervision-ivu": {
    "source": "iana",
    "extensions": ["ivu"]
  },
  "application/vnd.ims.imsccv1p1": {
    "source": "iana"
  },
  "application/vnd.ims.imsccv1p2": {
    "source": "iana"
  },
  "application/vnd.ims.imsccv1p3": {
    "source": "iana"
  },
  "application/vnd.ims.lis.v2.result+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolproxy+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolproxy.id+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolsettings+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.ims.lti.v2.toolsettings.simple+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.informedcontrol.rms+xml": {
    "source": "iana"
  },
  "application/vnd.informix-visionary": {
    "source": "iana"
  },
  "application/vnd.infotech.project": {
    "source": "iana"
  },
  "application/vnd.infotech.project+xml": {
    "source": "iana"
  },
  "application/vnd.innopath.wamp.notification": {
    "source": "iana"
  },
  "application/vnd.insors.igm": {
    "source": "iana",
    "extensions": ["igm"]
  },
  "application/vnd.intercon.formnet": {
    "source": "iana",
    "extensions": ["xpw","xpx"]
  },
  "application/vnd.intergeo": {
    "source": "iana",
    "extensions": ["i2g"]
  },
  "application/vnd.intertrust.digibox": {
    "source": "iana"
  },
  "application/vnd.intertrust.nncp": {
    "source": "iana"
  },
  "application/vnd.intu.qbo": {
    "source": "iana",
    "extensions": ["qbo"]
  },
  "application/vnd.intu.qfx": {
    "source": "iana",
    "extensions": ["qfx"]
  },
  "application/vnd.iptc.g2.catalogitem+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.conceptitem+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.knowledgeitem+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.newsitem+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.newsmessage+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.packageitem+xml": {
    "source": "iana"
  },
  "application/vnd.iptc.g2.planningitem+xml": {
    "source": "iana"
  },
  "application/vnd.ipunplugged.rcprofile": {
    "source": "iana",
    "extensions": ["rcprofile"]
  },
  "application/vnd.irepository.package+xml": {
    "source": "iana",
    "extensions": ["irp"]
  },
  "application/vnd.is-xpr": {
    "source": "iana",
    "extensions": ["xpr"]
  },
  "application/vnd.isac.fcs": {
    "source": "iana",
    "extensions": ["fcs"]
  },
  "application/vnd.jam": {
    "source": "iana",
    "extensions": ["jam"]
  },
  "application/vnd.japannet-directory-service": {
    "source": "iana"
  },
  "application/vnd.japannet-jpnstore-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-payment-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-registration": {
    "source": "iana"
  },
  "application/vnd.japannet-registration-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-setstore-wakeup": {
    "source": "iana"
  },
  "application/vnd.japannet-verification": {
    "source": "iana"
  },
  "application/vnd.japannet-verification-wakeup": {
    "source": "iana"
  },
  "application/vnd.jcp.javame.midlet-rms": {
    "source": "iana",
    "extensions": ["rms"]
  },
  "application/vnd.jisp": {
    "source": "iana",
    "extensions": ["jisp"]
  },
  "application/vnd.joost.joda-archive": {
    "source": "iana",
    "extensions": ["joda"]
  },
  "application/vnd.jsk.isdn-ngn": {
    "source": "iana"
  },
  "application/vnd.kahootz": {
    "source": "iana",
    "extensions": ["ktz","ktr"]
  },
  "application/vnd.kde.karbon": {
    "source": "iana",
    "extensions": ["karbon"]
  },
  "application/vnd.kde.kchart": {
    "source": "iana",
    "extensions": ["chrt"]
  },
  "application/vnd.kde.kformula": {
    "source": "iana",
    "extensions": ["kfo"]
  },
  "application/vnd.kde.kivio": {
    "source": "iana",
    "extensions": ["flw"]
  },
  "application/vnd.kde.kontour": {
    "source": "iana",
    "extensions": ["kon"]
  },
  "application/vnd.kde.kpresenter": {
    "source": "iana",
    "extensions": ["kpr","kpt"]
  },
  "application/vnd.kde.kspread": {
    "source": "iana",
    "extensions": ["ksp"]
  },
  "application/vnd.kde.kword": {
    "source": "iana",
    "extensions": ["kwd","kwt"]
  },
  "application/vnd.kenameaapp": {
    "source": "iana",
    "extensions": ["htke"]
  },
  "application/vnd.kidspiration": {
    "source": "iana",
    "extensions": ["kia"]
  },
  "application/vnd.kinar": {
    "source": "iana",
    "extensions": ["kne","knp"]
  },
  "application/vnd.koan": {
    "source": "iana",
    "extensions": ["skp","skd","skt","skm"]
  },
  "application/vnd.kodak-descriptor": {
    "source": "iana",
    "extensions": ["sse"]
  },
  "application/vnd.las.las+xml": {
    "source": "iana",
    "extensions": ["lasxml"]
  },
  "application/vnd.liberty-request+xml": {
    "source": "iana"
  },
  "application/vnd.llamagraphics.life-balance.desktop": {
    "source": "iana",
    "extensions": ["lbd"]
  },
  "application/vnd.llamagraphics.life-balance.exchange+xml": {
    "source": "iana",
    "extensions": ["lbe"]
  },
  "application/vnd.lotus-1-2-3": {
    "source": "iana",
    "extensions": ["123"]
  },
  "application/vnd.lotus-approach": {
    "source": "iana",
    "extensions": ["apr"]
  },
  "application/vnd.lotus-freelance": {
    "source": "iana",
    "extensions": ["pre"]
  },
  "application/vnd.lotus-notes": {
    "source": "iana",
    "extensions": ["nsf"]
  },
  "application/vnd.lotus-organizer": {
    "source": "iana",
    "extensions": ["org"]
  },
  "application/vnd.lotus-screencam": {
    "source": "iana",
    "extensions": ["scm"]
  },
  "application/vnd.lotus-wordpro": {
    "source": "iana",
    "extensions": ["lwp"]
  },
  "application/vnd.macports.portpkg": {
    "source": "iana",
    "extensions": ["portpkg"]
  },
  "application/vnd.mapbox-vector-tile": {
    "source": "iana"
  },
  "application/vnd.marlin.drm.actiontoken+xml": {
    "source": "iana"
  },
  "application/vnd.marlin.drm.conftoken+xml": {
    "source": "iana"
  },
  "application/vnd.marlin.drm.license+xml": {
    "source": "iana"
  },
  "application/vnd.marlin.drm.mdcf": {
    "source": "iana"
  },
  "application/vnd.mason+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.maxmind.maxmind-db": {
    "source": "iana"
  },
  "application/vnd.mcd": {
    "source": "iana",
    "extensions": ["mcd"]
  },
  "application/vnd.medcalcdata": {
    "source": "iana",
    "extensions": ["mc1"]
  },
  "application/vnd.mediastation.cdkey": {
    "source": "iana",
    "extensions": ["cdkey"]
  },
  "application/vnd.meridian-slingshot": {
    "source": "iana"
  },
  "application/vnd.mfer": {
    "source": "iana",
    "extensions": ["mwf"]
  },
  "application/vnd.mfmp": {
    "source": "iana",
    "extensions": ["mfm"]
  },
  "application/vnd.micro+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.micrografx.flo": {
    "source": "iana",
    "extensions": ["flo"]
  },
  "application/vnd.micrografx.igx": {
    "source": "iana",
    "extensions": ["igx"]
  },
  "application/vnd.microsoft.portable-executable": {
    "source": "iana"
  },
  "application/vnd.miele+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.mif": {
    "source": "iana",
    "extensions": ["mif"]
  },
  "application/vnd.minisoft-hp3000-save": {
    "source": "iana"
  },
  "application/vnd.mitsubishi.misty-guard.trustweb": {
    "source": "iana"
  },
  "application/vnd.mobius.daf": {
    "source": "iana",
    "extensions": ["daf"]
  },
  "application/vnd.mobius.dis": {
    "source": "iana",
    "extensions": ["dis"]
  },
  "application/vnd.mobius.mbk": {
    "source": "iana",
    "extensions": ["mbk"]
  },
  "application/vnd.mobius.mqy": {
    "source": "iana",
    "extensions": ["mqy"]
  },
  "application/vnd.mobius.msl": {
    "source": "iana",
    "extensions": ["msl"]
  },
  "application/vnd.mobius.plc": {
    "source": "iana",
    "extensions": ["plc"]
  },
  "application/vnd.mobius.txf": {
    "source": "iana",
    "extensions": ["txf"]
  },
  "application/vnd.mophun.application": {
    "source": "iana",
    "extensions": ["mpn"]
  },
  "application/vnd.mophun.certificate": {
    "source": "iana",
    "extensions": ["mpc"]
  },
  "application/vnd.motorola.flexsuite": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.adsi": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.fis": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.gotap": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.kmr": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.ttc": {
    "source": "iana"
  },
  "application/vnd.motorola.flexsuite.wem": {
    "source": "iana"
  },
  "application/vnd.motorola.iprm": {
    "source": "iana"
  },
  "application/vnd.mozilla.xul+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xul"]
  },
  "application/vnd.ms-3mfdocument": {
    "source": "iana"
  },
  "application/vnd.ms-artgalry": {
    "source": "iana",
    "extensions": ["cil"]
  },
  "application/vnd.ms-asf": {
    "source": "iana"
  },
  "application/vnd.ms-cab-compressed": {
    "source": "iana",
    "extensions": ["cab"]
  },
  "application/vnd.ms-color.iccprofile": {
    "source": "apache"
  },
  "application/vnd.ms-excel": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xls","xlm","xla","xlc","xlt","xlw"]
  },
  "application/vnd.ms-excel.addin.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlam"]
  },
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlsb"]
  },
  "application/vnd.ms-excel.sheet.macroenabled.12": {
    "source": "iana",
    "extensions": ["xlsm"]
  },
  "application/vnd.ms-excel.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["xltm"]
  },
  "application/vnd.ms-fontobject": {
    "source": "iana",
    "compressible": true,
    "extensions": ["eot"]
  },
  "application/vnd.ms-htmlhelp": {
    "source": "iana",
    "extensions": ["chm"]
  },
  "application/vnd.ms-ims": {
    "source": "iana",
    "extensions": ["ims"]
  },
  "application/vnd.ms-lrm": {
    "source": "iana",
    "extensions": ["lrm"]
  },
  "application/vnd.ms-office.activex+xml": {
    "source": "iana"
  },
  "application/vnd.ms-officetheme": {
    "source": "iana",
    "extensions": ["thmx"]
  },
  "application/vnd.ms-opentype": {
    "source": "apache",
    "compressible": true
  },
  "application/vnd.ms-package.obfuscated-opentype": {
    "source": "apache"
  },
  "application/vnd.ms-pki.seccat": {
    "source": "apache",
    "extensions": ["cat"]
  },
  "application/vnd.ms-pki.stl": {
    "source": "apache",
    "extensions": ["stl"]
  },
  "application/vnd.ms-playready.initiator+xml": {
    "source": "iana"
  },
  "application/vnd.ms-powerpoint": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ppt","pps","pot"]
  },
  "application/vnd.ms-powerpoint.addin.macroenabled.12": {
    "source": "iana",
    "extensions": ["ppam"]
  },
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
    "source": "iana",
    "extensions": ["pptm"]
  },
  "application/vnd.ms-powerpoint.slide.macroenabled.12": {
    "source": "iana",
    "extensions": ["sldm"]
  },
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
    "source": "iana",
    "extensions": ["ppsm"]
  },
  "application/vnd.ms-powerpoint.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["potm"]
  },
  "application/vnd.ms-printdevicecapabilities+xml": {
    "source": "iana"
  },
  "application/vnd.ms-printing.printticket+xml": {
    "source": "apache"
  },
  "application/vnd.ms-printschematicket+xml": {
    "source": "iana"
  },
  "application/vnd.ms-project": {
    "source": "iana",
    "extensions": ["mpp","mpt"]
  },
  "application/vnd.ms-tnef": {
    "source": "iana"
  },
  "application/vnd.ms-windows.devicepairing": {
    "source": "iana"
  },
  "application/vnd.ms-windows.nwprinting.oob": {
    "source": "iana"
  },
  "application/vnd.ms-windows.printerpairing": {
    "source": "iana"
  },
  "application/vnd.ms-windows.wsd.oob": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.lic-chlg-req": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.lic-resp": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.meter-chlg-req": {
    "source": "iana"
  },
  "application/vnd.ms-wmdrm.meter-resp": {
    "source": "iana"
  },
  "application/vnd.ms-word.document.macroenabled.12": {
    "source": "iana",
    "extensions": ["docm"]
  },
  "application/vnd.ms-word.template.macroenabled.12": {
    "source": "iana",
    "extensions": ["dotm"]
  },
  "application/vnd.ms-works": {
    "source": "iana",
    "extensions": ["wps","wks","wcm","wdb"]
  },
  "application/vnd.ms-wpl": {
    "source": "iana",
    "extensions": ["wpl"]
  },
  "application/vnd.ms-xpsdocument": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xps"]
  },
  "application/vnd.msa-disk-image": {
    "source": "iana"
  },
  "application/vnd.mseq": {
    "source": "iana",
    "extensions": ["mseq"]
  },
  "application/vnd.msign": {
    "source": "iana"
  },
  "application/vnd.multiad.creator": {
    "source": "iana"
  },
  "application/vnd.multiad.creator.cif": {
    "source": "iana"
  },
  "application/vnd.music-niff": {
    "source": "iana"
  },
  "application/vnd.musician": {
    "source": "iana",
    "extensions": ["mus"]
  },
  "application/vnd.muvee.style": {
    "source": "iana",
    "extensions": ["msty"]
  },
  "application/vnd.mynfc": {
    "source": "iana",
    "extensions": ["taglet"]
  },
  "application/vnd.ncd.control": {
    "source": "iana"
  },
  "application/vnd.ncd.reference": {
    "source": "iana"
  },
  "application/vnd.nearst.inv+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.nervana": {
    "source": "iana"
  },
  "application/vnd.netfpx": {
    "source": "iana"
  },
  "application/vnd.neurolanguage.nlu": {
    "source": "iana",
    "extensions": ["nlu"]
  },
  "application/vnd.nintendo.nitro.rom": {
    "source": "iana"
  },
  "application/vnd.nintendo.snes.rom": {
    "source": "iana"
  },
  "application/vnd.nitf": {
    "source": "iana",
    "extensions": ["ntf","nitf"]
  },
  "application/vnd.noblenet-directory": {
    "source": "iana",
    "extensions": ["nnd"]
  },
  "application/vnd.noblenet-sealer": {
    "source": "iana",
    "extensions": ["nns"]
  },
  "application/vnd.noblenet-web": {
    "source": "iana",
    "extensions": ["nnw"]
  },
  "application/vnd.nokia.catalogs": {
    "source": "iana"
  },
  "application/vnd.nokia.conml+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.conml+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.iptv.config+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.isds-radio-presets": {
    "source": "iana"
  },
  "application/vnd.nokia.landmark+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.landmark+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.landmarkcollection+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.n-gage.ac+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.n-gage.data": {
    "source": "iana",
    "extensions": ["ngdat"]
  },
  "application/vnd.nokia.n-gage.symbian.install": {
    "source": "iana",
    "extensions": ["n-gage"]
  },
  "application/vnd.nokia.ncd": {
    "source": "iana"
  },
  "application/vnd.nokia.pcd+wbxml": {
    "source": "iana"
  },
  "application/vnd.nokia.pcd+xml": {
    "source": "iana"
  },
  "application/vnd.nokia.radio-preset": {
    "source": "iana",
    "extensions": ["rpst"]
  },
  "application/vnd.nokia.radio-presets": {
    "source": "iana",
    "extensions": ["rpss"]
  },
  "application/vnd.novadigm.edm": {
    "source": "iana",
    "extensions": ["edm"]
  },
  "application/vnd.novadigm.edx": {
    "source": "iana",
    "extensions": ["edx"]
  },
  "application/vnd.novadigm.ext": {
    "source": "iana",
    "extensions": ["ext"]
  },
  "application/vnd.ntt-local.content-share": {
    "source": "iana"
  },
  "application/vnd.ntt-local.file-transfer": {
    "source": "iana"
  },
  "application/vnd.ntt-local.ogw_remote-access": {
    "source": "iana"
  },
  "application/vnd.ntt-local.sip-ta_remote": {
    "source": "iana"
  },
  "application/vnd.ntt-local.sip-ta_tcp_stream": {
    "source": "iana"
  },
  "application/vnd.oasis.opendocument.chart": {
    "source": "iana",
    "extensions": ["odc"]
  },
  "application/vnd.oasis.opendocument.chart-template": {
    "source": "iana",
    "extensions": ["otc"]
  },
  "application/vnd.oasis.opendocument.database": {
    "source": "iana",
    "extensions": ["odb"]
  },
  "application/vnd.oasis.opendocument.formula": {
    "source": "iana",
    "extensions": ["odf"]
  },
  "application/vnd.oasis.opendocument.formula-template": {
    "source": "iana",
    "extensions": ["odft"]
  },
  "application/vnd.oasis.opendocument.graphics": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odg"]
  },
  "application/vnd.oasis.opendocument.graphics-template": {
    "source": "iana",
    "extensions": ["otg"]
  },
  "application/vnd.oasis.opendocument.image": {
    "source": "iana",
    "extensions": ["odi"]
  },
  "application/vnd.oasis.opendocument.image-template": {
    "source": "iana",
    "extensions": ["oti"]
  },
  "application/vnd.oasis.opendocument.presentation": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odp"]
  },
  "application/vnd.oasis.opendocument.presentation-template": {
    "source": "iana",
    "extensions": ["otp"]
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    "source": "iana",
    "compressible": false,
    "extensions": ["ods"]
  },
  "application/vnd.oasis.opendocument.spreadsheet-template": {
    "source": "iana",
    "extensions": ["ots"]
  },
  "application/vnd.oasis.opendocument.text": {
    "source": "iana",
    "compressible": false,
    "extensions": ["odt"]
  },
  "application/vnd.oasis.opendocument.text-master": {
    "source": "iana",
    "extensions": ["odm"]
  },
  "application/vnd.oasis.opendocument.text-template": {
    "source": "iana",
    "extensions": ["ott"]
  },
  "application/vnd.oasis.opendocument.text-web": {
    "source": "iana",
    "extensions": ["oth"]
  },
  "application/vnd.obn": {
    "source": "iana"
  },
  "application/vnd.oftn.l10n+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oipf.contentaccessdownload+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.contentaccessstreaming+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.cspg-hexbinary": {
    "source": "iana"
  },
  "application/vnd.oipf.dae.svg+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.dae.xhtml+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.mippvcontrolmessage+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.pae.gem": {
    "source": "iana"
  },
  "application/vnd.oipf.spdiscovery+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.spdlist+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.ueprofile+xml": {
    "source": "iana"
  },
  "application/vnd.oipf.userprofile+xml": {
    "source": "iana"
  },
  "application/vnd.olpc-sugar": {
    "source": "iana",
    "extensions": ["xo"]
  },
  "application/vnd.oma-scws-config": {
    "source": "iana"
  },
  "application/vnd.oma-scws-http-request": {
    "source": "iana"
  },
  "application/vnd.oma-scws-http-response": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.drm-trigger+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.imd+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.ltkm": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.notification+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.provisioningtrigger": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sgboot": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sgdd+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sgdu": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.simple-symbol-container": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.smartcard-trigger+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.sprov+xml": {
    "source": "iana"
  },
  "application/vnd.oma.bcast.stkm": {
    "source": "iana"
  },
  "application/vnd.oma.cab-address-book+xml": {
    "source": "iana"
  },
  "application/vnd.oma.cab-feature-handler+xml": {
    "source": "iana"
  },
  "application/vnd.oma.cab-pcc+xml": {
    "source": "iana"
  },
  "application/vnd.oma.cab-subs-invite+xml": {
    "source": "iana"
  },
  "application/vnd.oma.cab-user-prefs+xml": {
    "source": "iana"
  },
  "application/vnd.oma.dcd": {
    "source": "iana"
  },
  "application/vnd.oma.dcdc": {
    "source": "iana"
  },
  "application/vnd.oma.dd2+xml": {
    "source": "iana",
    "extensions": ["dd2"]
  },
  "application/vnd.oma.drm.risd+xml": {
    "source": "iana"
  },
  "application/vnd.oma.group-usage-list+xml": {
    "source": "iana"
  },
  "application/vnd.oma.lwm2m+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.oma.lwm2m+tlv": {
    "source": "iana"
  },
  "application/vnd.oma.pal+xml": {
    "source": "iana"
  },
  "application/vnd.oma.poc.detailed-progress-report+xml": {
    "source": "iana"
  },
  "application/vnd.oma.poc.final-report+xml": {
    "source": "iana"
  },
  "application/vnd.oma.poc.groups+xml": {
    "source": "iana"
  },
  "application/vnd.oma.poc.invocation-descriptor+xml": {
    "source": "iana"
  },
  "application/vnd.oma.poc.optimized-progress-report+xml": {
    "source": "iana"
  },
  "application/vnd.oma.push": {
    "source": "iana"
  },
  "application/vnd.oma.scidm.messages+xml": {
    "source": "iana"
  },
  "application/vnd.oma.xcap-directory+xml": {
    "source": "iana"
  },
  "application/vnd.omads-email+xml": {
    "source": "iana"
  },
  "application/vnd.omads-file+xml": {
    "source": "iana"
  },
  "application/vnd.omads-folder+xml": {
    "source": "iana"
  },
  "application/vnd.omaloc-supl-init": {
    "source": "iana"
  },
  "application/vnd.onepager": {
    "source": "iana"
  },
  "application/vnd.openblox.game+xml": {
    "source": "iana"
  },
  "application/vnd.openblox.game-binary": {
    "source": "iana"
  },
  "application/vnd.openeye.oeb": {
    "source": "iana"
  },
  "application/vnd.openofficeorg.extension": {
    "source": "apache",
    "extensions": ["oxt"]
  },
  "application/vnd.openstreetmap.data+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawing+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml-template": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    "source": "iana",
    "compressible": false,
    "extensions": ["pptx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide": {
    "source": "iana",
    "extensions": ["sldx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
    "source": "iana",
    "extensions": ["ppsx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template": {
    "source": "apache",
    "extensions": ["potx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml-template": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    "source": "iana",
    "compressible": false,
    "extensions": ["xlsx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
    "source": "apache",
    "extensions": ["xltx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.theme+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.vmldrawing": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml-template": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    "source": "iana",
    "compressible": false,
    "extensions": ["docx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
    "source": "apache",
    "extensions": ["dotx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-package.core-properties+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
    "source": "iana"
  },
  "application/vnd.openxmlformats-package.relationships+xml": {
    "source": "iana"
  },
  "application/vnd.oracle.resource+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.orange.indata": {
    "source": "iana"
  },
  "application/vnd.osa.netdeploy": {
    "source": "iana"
  },
  "application/vnd.osgeo.mapguide.package": {
    "source": "iana",
    "extensions": ["mgp"]
  },
  "application/vnd.osgi.bundle": {
    "source": "iana"
  },
  "application/vnd.osgi.dp": {
    "source": "iana",
    "extensions": ["dp"]
  },
  "application/vnd.osgi.subsystem": {
    "source": "iana",
    "extensions": ["esa"]
  },
  "application/vnd.otps.ct-kip+xml": {
    "source": "iana"
  },
  "application/vnd.oxli.countgraph": {
    "source": "iana"
  },
  "application/vnd.pagerduty+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.palm": {
    "source": "iana",
    "extensions": ["pdb","pqa","oprc"]
  },
  "application/vnd.panoply": {
    "source": "iana"
  },
  "application/vnd.paos+xml": {
    "source": "iana"
  },
  "application/vnd.paos.xml": {
    "source": "apache"
  },
  "application/vnd.pawaafile": {
    "source": "iana",
    "extensions": ["paw"]
  },
  "application/vnd.pcos": {
    "source": "iana"
  },
  "application/vnd.pg.format": {
    "source": "iana",
    "extensions": ["str"]
  },
  "application/vnd.pg.osasli": {
    "source": "iana",
    "extensions": ["ei6"]
  },
  "application/vnd.piaccess.application-licence": {
    "source": "iana"
  },
  "application/vnd.picsel": {
    "source": "iana",
    "extensions": ["efif"]
  },
  "application/vnd.pmi.widget": {
    "source": "iana",
    "extensions": ["wg"]
  },
  "application/vnd.poc.group-advertisement+xml": {
    "source": "iana"
  },
  "application/vnd.pocketlearn": {
    "source": "iana",
    "extensions": ["plf"]
  },
  "application/vnd.powerbuilder6": {
    "source": "iana",
    "extensions": ["pbd"]
  },
  "application/vnd.powerbuilder6-s": {
    "source": "iana"
  },
  "application/vnd.powerbuilder7": {
    "source": "iana"
  },
  "application/vnd.powerbuilder7-s": {
    "source": "iana"
  },
  "application/vnd.powerbuilder75": {
    "source": "iana"
  },
  "application/vnd.powerbuilder75-s": {
    "source": "iana"
  },
  "application/vnd.preminet": {
    "source": "iana"
  },
  "application/vnd.previewsystems.box": {
    "source": "iana",
    "extensions": ["box"]
  },
  "application/vnd.proteus.magazine": {
    "source": "iana",
    "extensions": ["mgz"]
  },
  "application/vnd.publishare-delta-tree": {
    "source": "iana",
    "extensions": ["qps"]
  },
  "application/vnd.pvi.ptid1": {
    "source": "iana",
    "extensions": ["ptid"]
  },
  "application/vnd.pwg-multiplexed": {
    "source": "iana"
  },
  "application/vnd.pwg-xhtml-print+xml": {
    "source": "iana"
  },
  "application/vnd.qualcomm.brew-app-res": {
    "source": "iana"
  },
  "application/vnd.quarantainenet": {
    "source": "iana"
  },
  "application/vnd.quark.quarkxpress": {
    "source": "iana",
    "extensions": ["qxd","qxt","qwd","qwt","qxl","qxb"]
  },
  "application/vnd.quobject-quoxdocument": {
    "source": "iana"
  },
  "application/vnd.radisys.moml+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-audit+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-audit-conf+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-audit-conn+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-audit-dialog+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-audit-stream+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-conf+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-base+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-fax-detect+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-group+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-speech+xml": {
    "source": "iana"
  },
  "application/vnd.radisys.msml-dialog-transform+xml": {
    "source": "iana"
  },
  "application/vnd.rainstor.data": {
    "source": "iana"
  },
  "application/vnd.rapid": {
    "source": "iana"
  },
  "application/vnd.rar": {
    "source": "iana"
  },
  "application/vnd.realvnc.bed": {
    "source": "iana",
    "extensions": ["bed"]
  },
  "application/vnd.recordare.musicxml": {
    "source": "iana",
    "extensions": ["mxl"]
  },
  "application/vnd.recordare.musicxml+xml": {
    "source": "iana",
    "extensions": ["musicxml"]
  },
  "application/vnd.renlearn.rlprint": {
    "source": "iana"
  },
  "application/vnd.rig.cryptonote": {
    "source": "iana",
    "extensions": ["cryptonote"]
  },
  "application/vnd.rim.cod": {
    "source": "apache",
    "extensions": ["cod"]
  },
  "application/vnd.rn-realmedia": {
    "source": "apache",
    "extensions": ["rm"]
  },
  "application/vnd.rn-realmedia-vbr": {
    "source": "apache",
    "extensions": ["rmvb"]
  },
  "application/vnd.route66.link66+xml": {
    "source": "iana",
    "extensions": ["link66"]
  },
  "application/vnd.rs-274x": {
    "source": "iana"
  },
  "application/vnd.ruckus.download": {
    "source": "iana"
  },
  "application/vnd.s3sms": {
    "source": "iana"
  },
  "application/vnd.sailingtracker.track": {
    "source": "iana",
    "extensions": ["st"]
  },
  "application/vnd.sbm.cid": {
    "source": "iana"
  },
  "application/vnd.sbm.mid2": {
    "source": "iana"
  },
  "application/vnd.scribus": {
    "source": "iana"
  },
  "application/vnd.sealed.3df": {
    "source": "iana"
  },
  "application/vnd.sealed.csf": {
    "source": "iana"
  },
  "application/vnd.sealed.doc": {
    "source": "iana"
  },
  "application/vnd.sealed.eml": {
    "source": "iana"
  },
  "application/vnd.sealed.mht": {
    "source": "iana"
  },
  "application/vnd.sealed.net": {
    "source": "iana"
  },
  "application/vnd.sealed.ppt": {
    "source": "iana"
  },
  "application/vnd.sealed.tiff": {
    "source": "iana"
  },
  "application/vnd.sealed.xls": {
    "source": "iana"
  },
  "application/vnd.sealedmedia.softseal.html": {
    "source": "iana"
  },
  "application/vnd.sealedmedia.softseal.pdf": {
    "source": "iana"
  },
  "application/vnd.seemail": {
    "source": "iana",
    "extensions": ["see"]
  },
  "application/vnd.sema": {
    "source": "iana",
    "extensions": ["sema"]
  },
  "application/vnd.semd": {
    "source": "iana",
    "extensions": ["semd"]
  },
  "application/vnd.semf": {
    "source": "iana",
    "extensions": ["semf"]
  },
  "application/vnd.shana.informed.formdata": {
    "source": "iana",
    "extensions": ["ifm"]
  },
  "application/vnd.shana.informed.formtemplate": {
    "source": "iana",
    "extensions": ["itp"]
  },
  "application/vnd.shana.informed.interchange": {
    "source": "iana",
    "extensions": ["iif"]
  },
  "application/vnd.shana.informed.package": {
    "source": "iana",
    "extensions": ["ipk"]
  },
  "application/vnd.simtech-mindmapper": {
    "source": "iana",
    "extensions": ["twd","twds"]
  },
  "application/vnd.siren+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.smaf": {
    "source": "iana",
    "extensions": ["mmf"]
  },
  "application/vnd.smart.notebook": {
    "source": "iana"
  },
  "application/vnd.smart.teacher": {
    "source": "iana",
    "extensions": ["teacher"]
  },
  "application/vnd.software602.filler.form+xml": {
    "source": "iana"
  },
  "application/vnd.software602.filler.form-xml-zip": {
    "source": "iana"
  },
  "application/vnd.solent.sdkm+xml": {
    "source": "iana",
    "extensions": ["sdkm","sdkd"]
  },
  "application/vnd.spotfire.dxp": {
    "source": "iana",
    "extensions": ["dxp"]
  },
  "application/vnd.spotfire.sfs": {
    "source": "iana",
    "extensions": ["sfs"]
  },
  "application/vnd.sss-cod": {
    "source": "iana"
  },
  "application/vnd.sss-dtf": {
    "source": "iana"
  },
  "application/vnd.sss-ntf": {
    "source": "iana"
  },
  "application/vnd.stardivision.calc": {
    "source": "apache",
    "extensions": ["sdc"]
  },
  "application/vnd.stardivision.draw": {
    "source": "apache",
    "extensions": ["sda"]
  },
  "application/vnd.stardivision.impress": {
    "source": "apache",
    "extensions": ["sdd"]
  },
  "application/vnd.stardivision.math": {
    "source": "apache",
    "extensions": ["smf"]
  },
  "application/vnd.stardivision.writer": {
    "source": "apache",
    "extensions": ["sdw","vor"]
  },
  "application/vnd.stardivision.writer-global": {
    "source": "apache",
    "extensions": ["sgl"]
  },
  "application/vnd.stepmania.package": {
    "source": "iana",
    "extensions": ["smzip"]
  },
  "application/vnd.stepmania.stepchart": {
    "source": "iana",
    "extensions": ["sm"]
  },
  "application/vnd.street-stream": {
    "source": "iana"
  },
  "application/vnd.sun.wadl+xml": {
    "source": "iana"
  },
  "application/vnd.sun.xml.calc": {
    "source": "apache",
    "extensions": ["sxc"]
  },
  "application/vnd.sun.xml.calc.template": {
    "source": "apache",
    "extensions": ["stc"]
  },
  "application/vnd.sun.xml.draw": {
    "source": "apache",
    "extensions": ["sxd"]
  },
  "application/vnd.sun.xml.draw.template": {
    "source": "apache",
    "extensions": ["std"]
  },
  "application/vnd.sun.xml.impress": {
    "source": "apache",
    "extensions": ["sxi"]
  },
  "application/vnd.sun.xml.impress.template": {
    "source": "apache",
    "extensions": ["sti"]
  },
  "application/vnd.sun.xml.math": {
    "source": "apache",
    "extensions": ["sxm"]
  },
  "application/vnd.sun.xml.writer": {
    "source": "apache",
    "extensions": ["sxw"]
  },
  "application/vnd.sun.xml.writer.global": {
    "source": "apache",
    "extensions": ["sxg"]
  },
  "application/vnd.sun.xml.writer.template": {
    "source": "apache",
    "extensions": ["stw"]
  },
  "application/vnd.sus-calendar": {
    "source": "iana",
    "extensions": ["sus","susp"]
  },
  "application/vnd.svd": {
    "source": "iana",
    "extensions": ["svd"]
  },
  "application/vnd.swiftview-ics": {
    "source": "iana"
  },
  "application/vnd.symbian.install": {
    "source": "apache",
    "extensions": ["sis","sisx"]
  },
  "application/vnd.syncml+xml": {
    "source": "iana",
    "extensions": ["xsm"]
  },
  "application/vnd.syncml.dm+wbxml": {
    "source": "iana",
    "extensions": ["bdm"]
  },
  "application/vnd.syncml.dm+xml": {
    "source": "iana",
    "extensions": ["xdm"]
  },
  "application/vnd.syncml.dm.notification": {
    "source": "iana"
  },
  "application/vnd.syncml.dmddf+wbxml": {
    "source": "iana"
  },
  "application/vnd.syncml.dmddf+xml": {
    "source": "iana"
  },
  "application/vnd.syncml.dmtnds+wbxml": {
    "source": "iana"
  },
  "application/vnd.syncml.dmtnds+xml": {
    "source": "iana"
  },
  "application/vnd.syncml.ds.notification": {
    "source": "iana"
  },
  "application/vnd.tao.intent-module-archive": {
    "source": "iana",
    "extensions": ["tao"]
  },
  "application/vnd.tcpdump.pcap": {
    "source": "iana",
    "extensions": ["pcap","cap","dmp"]
  },
  "application/vnd.tmd.mediaflex.api+xml": {
    "source": "iana"
  },
  "application/vnd.tml": {
    "source": "iana"
  },
  "application/vnd.tmobile-livetv": {
    "source": "iana",
    "extensions": ["tmo"]
  },
  "application/vnd.tri.onesource": {
    "source": "iana"
  },
  "application/vnd.trid.tpt": {
    "source": "iana",
    "extensions": ["tpt"]
  },
  "application/vnd.triscape.mxs": {
    "source": "iana",
    "extensions": ["mxs"]
  },
  "application/vnd.trueapp": {
    "source": "iana",
    "extensions": ["tra"]
  },
  "application/vnd.truedoc": {
    "source": "iana"
  },
  "application/vnd.ubisoft.webplayer": {
    "source": "iana"
  },
  "application/vnd.ufdl": {
    "source": "iana",
    "extensions": ["ufd","ufdl"]
  },
  "application/vnd.uiq.theme": {
    "source": "iana",
    "extensions": ["utz"]
  },
  "application/vnd.umajin": {
    "source": "iana",
    "extensions": ["umj"]
  },
  "application/vnd.unity": {
    "source": "iana",
    "extensions": ["unityweb"]
  },
  "application/vnd.uoml+xml": {
    "source": "iana",
    "extensions": ["uoml"]
  },
  "application/vnd.uplanet.alert": {
    "source": "iana"
  },
  "application/vnd.uplanet.alert-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.bearer-choice": {
    "source": "iana"
  },
  "application/vnd.uplanet.bearer-choice-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.cacheop": {
    "source": "iana"
  },
  "application/vnd.uplanet.cacheop-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.channel": {
    "source": "iana"
  },
  "application/vnd.uplanet.channel-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.list": {
    "source": "iana"
  },
  "application/vnd.uplanet.list-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.listcmd": {
    "source": "iana"
  },
  "application/vnd.uplanet.listcmd-wbxml": {
    "source": "iana"
  },
  "application/vnd.uplanet.signal": {
    "source": "iana"
  },
  "application/vnd.uri-map": {
    "source": "iana"
  },
  "application/vnd.valve.source.material": {
    "source": "iana"
  },
  "application/vnd.vcx": {
    "source": "iana",
    "extensions": ["vcx"]
  },
  "application/vnd.vd-study": {
    "source": "iana"
  },
  "application/vnd.vectorworks": {
    "source": "iana"
  },
  "application/vnd.vel+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.verimatrix.vcas": {
    "source": "iana"
  },
  "application/vnd.vidsoft.vidconference": {
    "source": "iana"
  },
  "application/vnd.visio": {
    "source": "iana",
    "extensions": ["vsd","vst","vss","vsw"]
  },
  "application/vnd.visionary": {
    "source": "iana",
    "extensions": ["vis"]
  },
  "application/vnd.vividence.scriptfile": {
    "source": "iana"
  },
  "application/vnd.vsf": {
    "source": "iana",
    "extensions": ["vsf"]
  },
  "application/vnd.wap.sic": {
    "source": "iana"
  },
  "application/vnd.wap.slc": {
    "source": "iana"
  },
  "application/vnd.wap.wbxml": {
    "source": "iana",
    "extensions": ["wbxml"]
  },
  "application/vnd.wap.wmlc": {
    "source": "iana",
    "extensions": ["wmlc"]
  },
  "application/vnd.wap.wmlscriptc": {
    "source": "iana",
    "extensions": ["wmlsc"]
  },
  "application/vnd.webturbo": {
    "source": "iana",
    "extensions": ["wtb"]
  },
  "application/vnd.wfa.p2p": {
    "source": "iana"
  },
  "application/vnd.wfa.wsc": {
    "source": "iana"
  },
  "application/vnd.windows.devicepairing": {
    "source": "iana"
  },
  "application/vnd.wmc": {
    "source": "iana"
  },
  "application/vnd.wmf.bootstrap": {
    "source": "iana"
  },
  "application/vnd.wolfram.mathematica": {
    "source": "iana"
  },
  "application/vnd.wolfram.mathematica.package": {
    "source": "iana"
  },
  "application/vnd.wolfram.player": {
    "source": "iana",
    "extensions": ["nbp"]
  },
  "application/vnd.wordperfect": {
    "source": "iana",
    "extensions": ["wpd"]
  },
  "application/vnd.wqd": {
    "source": "iana",
    "extensions": ["wqd"]
  },
  "application/vnd.wrq-hp3000-labelled": {
    "source": "iana"
  },
  "application/vnd.wt.stf": {
    "source": "iana",
    "extensions": ["stf"]
  },
  "application/vnd.wv.csp+wbxml": {
    "source": "iana"
  },
  "application/vnd.wv.csp+xml": {
    "source": "iana"
  },
  "application/vnd.wv.ssp+xml": {
    "source": "iana"
  },
  "application/vnd.xacml+json": {
    "source": "iana",
    "compressible": true
  },
  "application/vnd.xara": {
    "source": "iana",
    "extensions": ["xar"]
  },
  "application/vnd.xfdl": {
    "source": "iana",
    "extensions": ["xfdl"]
  },
  "application/vnd.xfdl.webform": {
    "source": "iana"
  },
  "application/vnd.xmi+xml": {
    "source": "iana"
  },
  "application/vnd.xmpie.cpkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.dpkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.plan": {
    "source": "iana"
  },
  "application/vnd.xmpie.ppkg": {
    "source": "iana"
  },
  "application/vnd.xmpie.xlim": {
    "source": "iana"
  },
  "application/vnd.yamaha.hv-dic": {
    "source": "iana",
    "extensions": ["hvd"]
  },
  "application/vnd.yamaha.hv-script": {
    "source": "iana",
    "extensions": ["hvs"]
  },
  "application/vnd.yamaha.hv-voice": {
    "source": "iana",
    "extensions": ["hvp"]
  },
  "application/vnd.yamaha.openscoreformat": {
    "source": "iana",
    "extensions": ["osf"]
  },
  "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
    "source": "iana",
    "extensions": ["osfpvg"]
  },
  "application/vnd.yamaha.remote-setup": {
    "source": "iana"
  },
  "application/vnd.yamaha.smaf-audio": {
    "source": "iana",
    "extensions": ["saf"]
  },
  "application/vnd.yamaha.smaf-phrase": {
    "source": "iana",
    "extensions": ["spf"]
  },
  "application/vnd.yamaha.through-ngn": {
    "source": "iana"
  },
  "application/vnd.yamaha.tunnel-udpencap": {
    "source": "iana"
  },
  "application/vnd.yaoweme": {
    "source": "iana"
  },
  "application/vnd.yellowriver-custom-menu": {
    "source": "iana",
    "extensions": ["cmp"]
  },
  "application/vnd.zul": {
    "source": "iana",
    "extensions": ["zir","zirz"]
  },
  "application/vnd.zzazz.deck+xml": {
    "source": "iana",
    "extensions": ["zaz"]
  },
  "application/voicexml+xml": {
    "source": "iana",
    "extensions": ["vxml"]
  },
  "application/vq-rtcpxr": {
    "source": "iana"
  },
  "application/watcherinfo+xml": {
    "source": "iana"
  },
  "application/whoispp-query": {
    "source": "iana"
  },
  "application/whoispp-response": {
    "source": "iana"
  },
  "application/widget": {
    "source": "iana",
    "extensions": ["wgt"]
  },
  "application/winhlp": {
    "source": "apache",
    "extensions": ["hlp"]
  },
  "application/wita": {
    "source": "iana"
  },
  "application/wordperfect5.1": {
    "source": "iana"
  },
  "application/wsdl+xml": {
    "source": "iana",
    "extensions": ["wsdl"]
  },
  "application/wspolicy+xml": {
    "source": "iana",
    "extensions": ["wspolicy"]
  },
  "application/x-7z-compressed": {
    "source": "apache",
    "compressible": false,
    "extensions": ["7z"]
  },
  "application/x-abiword": {
    "source": "apache",
    "extensions": ["abw"]
  },
  "application/x-ace-compressed": {
    "source": "apache",
    "extensions": ["ace"]
  },
  "application/x-amf": {
    "source": "apache"
  },
  "application/x-apple-diskimage": {
    "source": "apache",
    "extensions": ["dmg"]
  },
  "application/x-authorware-bin": {
    "source": "apache",
    "extensions": ["aab","x32","u32","vox"]
  },
  "application/x-authorware-map": {
    "source": "apache",
    "extensions": ["aam"]
  },
  "application/x-authorware-seg": {
    "source": "apache",
    "extensions": ["aas"]
  },
  "application/x-bcpio": {
    "source": "apache",
    "extensions": ["bcpio"]
  },
  "application/x-bdoc": {
    "compressible": false,
    "extensions": ["bdoc"]
  },
  "application/x-bittorrent": {
    "source": "apache",
    "extensions": ["torrent"]
  },
  "application/x-blorb": {
    "source": "apache",
    "extensions": ["blb","blorb"]
  },
  "application/x-bzip": {
    "source": "apache",
    "compressible": false,
    "extensions": ["bz"]
  },
  "application/x-bzip2": {
    "source": "apache",
    "compressible": false,
    "extensions": ["bz2","boz"]
  },
  "application/x-cbr": {
    "source": "apache",
    "extensions": ["cbr","cba","cbt","cbz","cb7"]
  },
  "application/x-cdlink": {
    "source": "apache",
    "extensions": ["vcd"]
  },
  "application/x-cfs-compressed": {
    "source": "apache",
    "extensions": ["cfs"]
  },
  "application/x-chat": {
    "source": "apache",
    "extensions": ["chat"]
  },
  "application/x-chess-pgn": {
    "source": "apache",
    "extensions": ["pgn"]
  },
  "application/x-chrome-extension": {
    "extensions": ["crx"]
  },
  "application/x-cocoa": {
    "source": "nginx",
    "extensions": ["cco"]
  },
  "application/x-compress": {
    "source": "apache"
  },
  "application/x-conference": {
    "source": "apache",
    "extensions": ["nsc"]
  },
  "application/x-cpio": {
    "source": "apache",
    "extensions": ["cpio"]
  },
  "application/x-csh": {
    "source": "apache",
    "extensions": ["csh"]
  },
  "application/x-deb": {
    "compressible": false
  },
  "application/x-debian-package": {
    "source": "apache",
    "extensions": ["deb","udeb"]
  },
  "application/x-dgc-compressed": {
    "source": "apache",
    "extensions": ["dgc"]
  },
  "application/x-director": {
    "source": "apache",
    "extensions": ["dir","dcr","dxr","cst","cct","cxt","w3d","fgd","swa"]
  },
  "application/x-doom": {
    "source": "apache",
    "extensions": ["wad"]
  },
  "application/x-dtbncx+xml": {
    "source": "apache",
    "extensions": ["ncx"]
  },
  "application/x-dtbook+xml": {
    "source": "apache",
    "extensions": ["dtb"]
  },
  "application/x-dtbresource+xml": {
    "source": "apache",
    "extensions": ["res"]
  },
  "application/x-dvi": {
    "source": "apache",
    "compressible": false,
    "extensions": ["dvi"]
  },
  "application/x-envoy": {
    "source": "apache",
    "extensions": ["evy"]
  },
  "application/x-eva": {
    "source": "apache",
    "extensions": ["eva"]
  },
  "application/x-font-bdf": {
    "source": "apache",
    "extensions": ["bdf"]
  },
  "application/x-font-dos": {
    "source": "apache"
  },
  "application/x-font-framemaker": {
    "source": "apache"
  },
  "application/x-font-ghostscript": {
    "source": "apache",
    "extensions": ["gsf"]
  },
  "application/x-font-libgrx": {
    "source": "apache"
  },
  "application/x-font-linux-psf": {
    "source": "apache",
    "extensions": ["psf"]
  },
  "application/x-font-otf": {
    "source": "apache",
    "compressible": true,
    "extensions": ["otf"]
  },
  "application/x-font-pcf": {
    "source": "apache",
    "extensions": ["pcf"]
  },
  "application/x-font-snf": {
    "source": "apache",
    "extensions": ["snf"]
  },
  "application/x-font-speedo": {
    "source": "apache"
  },
  "application/x-font-sunos-news": {
    "source": "apache"
  },
  "application/x-font-ttf": {
    "source": "apache",
    "compressible": true,
    "extensions": ["ttf","ttc"]
  },
  "application/x-font-type1": {
    "source": "apache",
    "extensions": ["pfa","pfb","pfm","afm"]
  },
  "application/x-font-vfont": {
    "source": "apache"
  },
  "application/x-freearc": {
    "source": "apache",
    "extensions": ["arc"]
  },
  "application/x-futuresplash": {
    "source": "apache",
    "extensions": ["spl"]
  },
  "application/x-gca-compressed": {
    "source": "apache",
    "extensions": ["gca"]
  },
  "application/x-glulx": {
    "source": "apache",
    "extensions": ["ulx"]
  },
  "application/x-gnumeric": {
    "source": "apache",
    "extensions": ["gnumeric"]
  },
  "application/x-gramps-xml": {
    "source": "apache",
    "extensions": ["gramps"]
  },
  "application/x-gtar": {
    "source": "apache",
    "extensions": ["gtar"]
  },
  "application/x-gzip": {
    "source": "apache"
  },
  "application/x-hdf": {
    "source": "apache",
    "extensions": ["hdf"]
  },
  "application/x-httpd-php": {
    "compressible": true,
    "extensions": ["php"]
  },
  "application/x-install-instructions": {
    "source": "apache",
    "extensions": ["install"]
  },
  "application/x-iso9660-image": {
    "source": "apache",
    "extensions": ["iso"]
  },
  "application/x-java-archive-diff": {
    "source": "nginx",
    "extensions": ["jardiff"]
  },
  "application/x-java-jnlp-file": {
    "source": "apache",
    "compressible": false,
    "extensions": ["jnlp"]
  },
  "application/x-javascript": {
    "compressible": true
  },
  "application/x-latex": {
    "source": "apache",
    "compressible": false,
    "extensions": ["latex"]
  },
  "application/x-lua-bytecode": {
    "extensions": ["luac"]
  },
  "application/x-lzh-compressed": {
    "source": "apache",
    "extensions": ["lzh","lha"]
  },
  "application/x-makeself": {
    "source": "nginx",
    "extensions": ["run"]
  },
  "application/x-mie": {
    "source": "apache",
    "extensions": ["mie"]
  },
  "application/x-mobipocket-ebook": {
    "source": "apache",
    "extensions": ["prc","mobi"]
  },
  "application/x-mpegurl": {
    "compressible": false
  },
  "application/x-ms-application": {
    "source": "apache",
    "extensions": ["application"]
  },
  "application/x-ms-shortcut": {
    "source": "apache",
    "extensions": ["lnk"]
  },
  "application/x-ms-wmd": {
    "source": "apache",
    "extensions": ["wmd"]
  },
  "application/x-ms-wmz": {
    "source": "apache",
    "extensions": ["wmz"]
  },
  "application/x-ms-xbap": {
    "source": "apache",
    "extensions": ["xbap"]
  },
  "application/x-msaccess": {
    "source": "apache",
    "extensions": ["mdb"]
  },
  "application/x-msbinder": {
    "source": "apache",
    "extensions": ["obd"]
  },
  "application/x-mscardfile": {
    "source": "apache",
    "extensions": ["crd"]
  },
  "application/x-msclip": {
    "source": "apache",
    "extensions": ["clp"]
  },
  "application/x-msdos-program": {
    "extensions": ["exe"]
  },
  "application/x-msdownload": {
    "source": "apache",
    "extensions": ["exe","dll","com","bat","msi"]
  },
  "application/x-msmediaview": {
    "source": "apache",
    "extensions": ["mvb","m13","m14"]
  },
  "application/x-msmetafile": {
    "source": "apache",
    "extensions": ["wmf","wmz","emf","emz"]
  },
  "application/x-msmoney": {
    "source": "apache",
    "extensions": ["mny"]
  },
  "application/x-mspublisher": {
    "source": "apache",
    "extensions": ["pub"]
  },
  "application/x-msschedule": {
    "source": "apache",
    "extensions": ["scd"]
  },
  "application/x-msterminal": {
    "source": "apache",
    "extensions": ["trm"]
  },
  "application/x-mswrite": {
    "source": "apache",
    "extensions": ["wri"]
  },
  "application/x-netcdf": {
    "source": "apache",
    "extensions": ["nc","cdf"]
  },
  "application/x-ns-proxy-autoconfig": {
    "compressible": true,
    "extensions": ["pac"]
  },
  "application/x-nzb": {
    "source": "apache",
    "extensions": ["nzb"]
  },
  "application/x-perl": {
    "source": "nginx",
    "extensions": ["pl","pm"]
  },
  "application/x-pilot": {
    "source": "nginx",
    "extensions": ["prc","pdb"]
  },
  "application/x-pkcs12": {
    "source": "apache",
    "compressible": false,
    "extensions": ["p12","pfx"]
  },
  "application/x-pkcs7-certificates": {
    "source": "apache",
    "extensions": ["p7b","spc"]
  },
  "application/x-pkcs7-certreqresp": {
    "source": "apache",
    "extensions": ["p7r"]
  },
  "application/x-rar-compressed": {
    "source": "apache",
    "compressible": false,
    "extensions": ["rar"]
  },
  "application/x-redhat-package-manager": {
    "source": "nginx",
    "extensions": ["rpm"]
  },
  "application/x-research-info-systems": {
    "source": "apache",
    "extensions": ["ris"]
  },
  "application/x-sea": {
    "source": "nginx",
    "extensions": ["sea"]
  },
  "application/x-sh": {
    "source": "apache",
    "compressible": true,
    "extensions": ["sh"]
  },
  "application/x-shar": {
    "source": "apache",
    "extensions": ["shar"]
  },
  "application/x-shockwave-flash": {
    "source": "apache",
    "compressible": false,
    "extensions": ["swf"]
  },
  "application/x-silverlight-app": {
    "source": "apache",
    "extensions": ["xap"]
  },
  "application/x-sql": {
    "source": "apache",
    "extensions": ["sql"]
  },
  "application/x-stuffit": {
    "source": "apache",
    "compressible": false,
    "extensions": ["sit"]
  },
  "application/x-stuffitx": {
    "source": "apache",
    "extensions": ["sitx"]
  },
  "application/x-subrip": {
    "source": "apache",
    "extensions": ["srt"]
  },
  "application/x-sv4cpio": {
    "source": "apache",
    "extensions": ["sv4cpio"]
  },
  "application/x-sv4crc": {
    "source": "apache",
    "extensions": ["sv4crc"]
  },
  "application/x-t3vm-image": {
    "source": "apache",
    "extensions": ["t3"]
  },
  "application/x-tads": {
    "source": "apache",
    "extensions": ["gam"]
  },
  "application/x-tar": {
    "source": "apache",
    "compressible": true,
    "extensions": ["tar"]
  },
  "application/x-tcl": {
    "source": "apache",
    "extensions": ["tcl","tk"]
  },
  "application/x-tex": {
    "source": "apache",
    "extensions": ["tex"]
  },
  "application/x-tex-tfm": {
    "source": "apache",
    "extensions": ["tfm"]
  },
  "application/x-texinfo": {
    "source": "apache",
    "extensions": ["texinfo","texi"]
  },
  "application/x-tgif": {
    "source": "apache",
    "extensions": ["obj"]
  },
  "application/x-ustar": {
    "source": "apache",
    "extensions": ["ustar"]
  },
  "application/x-wais-source": {
    "source": "apache",
    "extensions": ["src"]
  },
  "application/x-web-app-manifest+json": {
    "compressible": true,
    "extensions": ["webapp"]
  },
  "application/x-www-form-urlencoded": {
    "source": "iana",
    "compressible": true
  },
  "application/x-x509-ca-cert": {
    "source": "apache",
    "extensions": ["der","crt","pem"]
  },
  "application/x-xfig": {
    "source": "apache",
    "extensions": ["fig"]
  },
  "application/x-xliff+xml": {
    "source": "apache",
    "extensions": ["xlf"]
  },
  "application/x-xpinstall": {
    "source": "apache",
    "compressible": false,
    "extensions": ["xpi"]
  },
  "application/x-xz": {
    "source": "apache",
    "extensions": ["xz"]
  },
  "application/x-zmachine": {
    "source": "apache",
    "extensions": ["z1","z2","z3","z4","z5","z6","z7","z8"]
  },
  "application/x400-bp": {
    "source": "iana"
  },
  "application/xacml+xml": {
    "source": "iana"
  },
  "application/xaml+xml": {
    "source": "apache",
    "extensions": ["xaml"]
  },
  "application/xcap-att+xml": {
    "source": "iana"
  },
  "application/xcap-caps+xml": {
    "source": "iana"
  },
  "application/xcap-diff+xml": {
    "source": "iana",
    "extensions": ["xdf"]
  },
  "application/xcap-el+xml": {
    "source": "iana"
  },
  "application/xcap-error+xml": {
    "source": "iana"
  },
  "application/xcap-ns+xml": {
    "source": "iana"
  },
  "application/xcon-conference-info+xml": {
    "source": "iana"
  },
  "application/xcon-conference-info-diff+xml": {
    "source": "iana"
  },
  "application/xenc+xml": {
    "source": "iana",
    "extensions": ["xenc"]
  },
  "application/xhtml+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xhtml","xht"]
  },
  "application/xhtml-voice+xml": {
    "source": "apache"
  },
  "application/xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xml","xsl","xsd","rng"]
  },
  "application/xml-dtd": {
    "source": "iana",
    "compressible": true,
    "extensions": ["dtd"]
  },
  "application/xml-external-parsed-entity": {
    "source": "iana"
  },
  "application/xml-patch+xml": {
    "source": "iana"
  },
  "application/xmpp+xml": {
    "source": "iana"
  },
  "application/xop+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xop"]
  },
  "application/xproc+xml": {
    "source": "apache",
    "extensions": ["xpl"]
  },
  "application/xslt+xml": {
    "source": "iana",
    "extensions": ["xslt"]
  },
  "application/xspf+xml": {
    "source": "apache",
    "extensions": ["xspf"]
  },
  "application/xv+xml": {
    "source": "iana",
    "extensions": ["mxml","xhvml","xvml","xvm"]
  },
  "application/yang": {
    "source": "iana",
    "extensions": ["yang"]
  },
  "application/yang-data+json": {
    "source": "iana",
    "compressible": true
  },
  "application/yang-data+xml": {
    "source": "iana"
  },
  "application/yin+xml": {
    "source": "iana",
    "extensions": ["yin"]
  },
  "application/zip": {
    "source": "iana",
    "compressible": false,
    "extensions": ["zip"]
  },
  "application/zlib": {
    "source": "iana"
  },
  "audio/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "audio/32kadpcm": {
    "source": "iana"
  },
  "audio/3gpp": {
    "source": "iana",
    "compressible": false,
    "extensions": ["3gpp"]
  },
  "audio/3gpp2": {
    "source": "iana"
  },
  "audio/ac3": {
    "source": "iana"
  },
  "audio/adpcm": {
    "source": "apache",
    "extensions": ["adp"]
  },
  "audio/amr": {
    "source": "iana"
  },
  "audio/amr-wb": {
    "source": "iana"
  },
  "audio/amr-wb+": {
    "source": "iana"
  },
  "audio/aptx": {
    "source": "iana"
  },
  "audio/asc": {
    "source": "iana"
  },
  "audio/atrac-advanced-lossless": {
    "source": "iana"
  },
  "audio/atrac-x": {
    "source": "iana"
  },
  "audio/atrac3": {
    "source": "iana"
  },
  "audio/basic": {
    "source": "iana",
    "compressible": false,
    "extensions": ["au","snd"]
  },
  "audio/bv16": {
    "source": "iana"
  },
  "audio/bv32": {
    "source": "iana"
  },
  "audio/clearmode": {
    "source": "iana"
  },
  "audio/cn": {
    "source": "iana"
  },
  "audio/dat12": {
    "source": "iana"
  },
  "audio/dls": {
    "source": "iana"
  },
  "audio/dsr-es201108": {
    "source": "iana"
  },
  "audio/dsr-es202050": {
    "source": "iana"
  },
  "audio/dsr-es202211": {
    "source": "iana"
  },
  "audio/dsr-es202212": {
    "source": "iana"
  },
  "audio/dv": {
    "source": "iana"
  },
  "audio/dvi4": {
    "source": "iana"
  },
  "audio/eac3": {
    "source": "iana"
  },
  "audio/encaprtp": {
    "source": "iana"
  },
  "audio/evrc": {
    "source": "iana"
  },
  "audio/evrc-qcp": {
    "source": "iana"
  },
  "audio/evrc0": {
    "source": "iana"
  },
  "audio/evrc1": {
    "source": "iana"
  },
  "audio/evrcb": {
    "source": "iana"
  },
  "audio/evrcb0": {
    "source": "iana"
  },
  "audio/evrcb1": {
    "source": "iana"
  },
  "audio/evrcnw": {
    "source": "iana"
  },
  "audio/evrcnw0": {
    "source": "iana"
  },
  "audio/evrcnw1": {
    "source": "iana"
  },
  "audio/evrcwb": {
    "source": "iana"
  },
  "audio/evrcwb0": {
    "source": "iana"
  },
  "audio/evrcwb1": {
    "source": "iana"
  },
  "audio/evs": {
    "source": "iana"
  },
  "audio/fwdred": {
    "source": "iana"
  },
  "audio/g711-0": {
    "source": "iana"
  },
  "audio/g719": {
    "source": "iana"
  },
  "audio/g722": {
    "source": "iana"
  },
  "audio/g7221": {
    "source": "iana"
  },
  "audio/g723": {
    "source": "iana"
  },
  "audio/g726-16": {
    "source": "iana"
  },
  "audio/g726-24": {
    "source": "iana"
  },
  "audio/g726-32": {
    "source": "iana"
  },
  "audio/g726-40": {
    "source": "iana"
  },
  "audio/g728": {
    "source": "iana"
  },
  "audio/g729": {
    "source": "iana"
  },
  "audio/g7291": {
    "source": "iana"
  },
  "audio/g729d": {
    "source": "iana"
  },
  "audio/g729e": {
    "source": "iana"
  },
  "audio/gsm": {
    "source": "iana"
  },
  "audio/gsm-efr": {
    "source": "iana"
  },
  "audio/gsm-hr-08": {
    "source": "iana"
  },
  "audio/ilbc": {
    "source": "iana"
  },
  "audio/ip-mr_v2.5": {
    "source": "iana"
  },
  "audio/isac": {
    "source": "apache"
  },
  "audio/l16": {
    "source": "iana"
  },
  "audio/l20": {
    "source": "iana"
  },
  "audio/l24": {
    "source": "iana",
    "compressible": false
  },
  "audio/l8": {
    "source": "iana"
  },
  "audio/lpc": {
    "source": "iana"
  },
  "audio/midi": {
    "source": "apache",
    "extensions": ["mid","midi","kar","rmi"]
  },
  "audio/mobile-xmf": {
    "source": "iana"
  },
  "audio/mp3": {
    "compressible": false,
    "extensions": ["mp3"]
  },
  "audio/mp4": {
    "source": "iana",
    "compressible": false,
    "extensions": ["m4a","mp4a"]
  },
  "audio/mp4a-latm": {
    "source": "iana"
  },
  "audio/mpa": {
    "source": "iana"
  },
  "audio/mpa-robust": {
    "source": "iana"
  },
  "audio/mpeg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["mpga","mp2","mp2a","mp3","m2a","m3a"]
  },
  "audio/mpeg4-generic": {
    "source": "iana"
  },
  "audio/musepack": {
    "source": "apache"
  },
  "audio/ogg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["oga","ogg","spx"]
  },
  "audio/opus": {
    "source": "iana"
  },
  "audio/parityfec": {
    "source": "iana"
  },
  "audio/pcma": {
    "source": "iana"
  },
  "audio/pcma-wb": {
    "source": "iana"
  },
  "audio/pcmu": {
    "source": "iana"
  },
  "audio/pcmu-wb": {
    "source": "iana"
  },
  "audio/prs.sid": {
    "source": "iana"
  },
  "audio/qcelp": {
    "source": "iana"
  },
  "audio/raptorfec": {
    "source": "iana"
  },
  "audio/red": {
    "source": "iana"
  },
  "audio/rtp-enc-aescm128": {
    "source": "iana"
  },
  "audio/rtp-midi": {
    "source": "iana"
  },
  "audio/rtploopback": {
    "source": "iana"
  },
  "audio/rtx": {
    "source": "iana"
  },
  "audio/s3m": {
    "source": "apache",
    "extensions": ["s3m"]
  },
  "audio/silk": {
    "source": "apache",
    "extensions": ["sil"]
  },
  "audio/smv": {
    "source": "iana"
  },
  "audio/smv-qcp": {
    "source": "iana"
  },
  "audio/smv0": {
    "source": "iana"
  },
  "audio/sp-midi": {
    "source": "iana"
  },
  "audio/speex": {
    "source": "iana"
  },
  "audio/t140c": {
    "source": "iana"
  },
  "audio/t38": {
    "source": "iana"
  },
  "audio/telephone-event": {
    "source": "iana"
  },
  "audio/tone": {
    "source": "iana"
  },
  "audio/uemclip": {
    "source": "iana"
  },
  "audio/ulpfec": {
    "source": "iana"
  },
  "audio/vdvi": {
    "source": "iana"
  },
  "audio/vmr-wb": {
    "source": "iana"
  },
  "audio/vnd.3gpp.iufp": {
    "source": "iana"
  },
  "audio/vnd.4sb": {
    "source": "iana"
  },
  "audio/vnd.audiokoz": {
    "source": "iana"
  },
  "audio/vnd.celp": {
    "source": "iana"
  },
  "audio/vnd.cisco.nse": {
    "source": "iana"
  },
  "audio/vnd.cmles.radio-events": {
    "source": "iana"
  },
  "audio/vnd.cns.anp1": {
    "source": "iana"
  },
  "audio/vnd.cns.inf1": {
    "source": "iana"
  },
  "audio/vnd.dece.audio": {
    "source": "iana",
    "extensions": ["uva","uvva"]
  },
  "audio/vnd.digital-winds": {
    "source": "iana",
    "extensions": ["eol"]
  },
  "audio/vnd.dlna.adts": {
    "source": "iana"
  },
  "audio/vnd.dolby.heaac.1": {
    "source": "iana"
  },
  "audio/vnd.dolby.heaac.2": {
    "source": "iana"
  },
  "audio/vnd.dolby.mlp": {
    "source": "iana"
  },
  "audio/vnd.dolby.mps": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2x": {
    "source": "iana"
  },
  "audio/vnd.dolby.pl2z": {
    "source": "iana"
  },
  "audio/vnd.dolby.pulse.1": {
    "source": "iana"
  },
  "audio/vnd.dra": {
    "source": "iana",
    "extensions": ["dra"]
  },
  "audio/vnd.dts": {
    "source": "iana",
    "extensions": ["dts"]
  },
  "audio/vnd.dts.hd": {
    "source": "iana",
    "extensions": ["dtshd"]
  },
  "audio/vnd.dvb.file": {
    "source": "iana"
  },
  "audio/vnd.everad.plj": {
    "source": "iana"
  },
  "audio/vnd.hns.audio": {
    "source": "iana"
  },
  "audio/vnd.lucent.voice": {
    "source": "iana",
    "extensions": ["lvp"]
  },
  "audio/vnd.ms-playready.media.pya": {
    "source": "iana",
    "extensions": ["pya"]
  },
  "audio/vnd.nokia.mobile-xmf": {
    "source": "iana"
  },
  "audio/vnd.nortel.vbk": {
    "source": "iana"
  },
  "audio/vnd.nuera.ecelp4800": {
    "source": "iana",
    "extensions": ["ecelp4800"]
  },
  "audio/vnd.nuera.ecelp7470": {
    "source": "iana",
    "extensions": ["ecelp7470"]
  },
  "audio/vnd.nuera.ecelp9600": {
    "source": "iana",
    "extensions": ["ecelp9600"]
  },
  "audio/vnd.octel.sbc": {
    "source": "iana"
  },
  "audio/vnd.qcelp": {
    "source": "iana"
  },
  "audio/vnd.rhetorex.32kadpcm": {
    "source": "iana"
  },
  "audio/vnd.rip": {
    "source": "iana",
    "extensions": ["rip"]
  },
  "audio/vnd.rn-realaudio": {
    "compressible": false
  },
  "audio/vnd.sealedmedia.softseal.mpeg": {
    "source": "iana"
  },
  "audio/vnd.vmx.cvsd": {
    "source": "iana"
  },
  "audio/vnd.wave": {
    "compressible": false
  },
  "audio/vorbis": {
    "source": "iana",
    "compressible": false
  },
  "audio/vorbis-config": {
    "source": "iana"
  },
  "audio/wav": {
    "compressible": false,
    "extensions": ["wav"]
  },
  "audio/wave": {
    "compressible": false,
    "extensions": ["wav"]
  },
  "audio/webm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["weba"]
  },
  "audio/x-aac": {
    "source": "apache",
    "compressible": false,
    "extensions": ["aac"]
  },
  "audio/x-aiff": {
    "source": "apache",
    "extensions": ["aif","aiff","aifc"]
  },
  "audio/x-caf": {
    "source": "apache",
    "compressible": false,
    "extensions": ["caf"]
  },
  "audio/x-flac": {
    "source": "apache",
    "extensions": ["flac"]
  },
  "audio/x-m4a": {
    "source": "nginx",
    "extensions": ["m4a"]
  },
  "audio/x-matroska": {
    "source": "apache",
    "extensions": ["mka"]
  },
  "audio/x-mpegurl": {
    "source": "apache",
    "extensions": ["m3u"]
  },
  "audio/x-ms-wax": {
    "source": "apache",
    "extensions": ["wax"]
  },
  "audio/x-ms-wma": {
    "source": "apache",
    "extensions": ["wma"]
  },
  "audio/x-pn-realaudio": {
    "source": "apache",
    "extensions": ["ram","ra"]
  },
  "audio/x-pn-realaudio-plugin": {
    "source": "apache",
    "extensions": ["rmp"]
  },
  "audio/x-realaudio": {
    "source": "nginx",
    "extensions": ["ra"]
  },
  "audio/x-tta": {
    "source": "apache"
  },
  "audio/x-wav": {
    "source": "apache",
    "extensions": ["wav"]
  },
  "audio/xm": {
    "source": "apache",
    "extensions": ["xm"]
  },
  "chemical/x-cdx": {
    "source": "apache",
    "extensions": ["cdx"]
  },
  "chemical/x-cif": {
    "source": "apache",
    "extensions": ["cif"]
  },
  "chemical/x-cmdf": {
    "source": "apache",
    "extensions": ["cmdf"]
  },
  "chemical/x-cml": {
    "source": "apache",
    "extensions": ["cml"]
  },
  "chemical/x-csml": {
    "source": "apache",
    "extensions": ["csml"]
  },
  "chemical/x-pdb": {
    "source": "apache"
  },
  "chemical/x-xyz": {
    "source": "apache",
    "extensions": ["xyz"]
  },
  "font/opentype": {
    "compressible": true,
    "extensions": ["otf"]
  },
  "image/bmp": {
    "source": "iana",
    "compressible": true,
    "extensions": ["bmp"]
  },
  "image/cgm": {
    "source": "iana",
    "extensions": ["cgm"]
  },
  "image/dicom-rle": {
    "source": "iana"
  },
  "image/emf": {
    "source": "iana"
  },
  "image/fits": {
    "source": "iana"
  },
  "image/g3fax": {
    "source": "iana",
    "extensions": ["g3"]
  },
  "image/gif": {
    "source": "iana",
    "compressible": false,
    "extensions": ["gif"]
  },
  "image/ief": {
    "source": "iana",
    "extensions": ["ief"]
  },
  "image/jls": {
    "source": "iana"
  },
  "image/jp2": {
    "source": "iana"
  },
  "image/jpeg": {
    "source": "iana",
    "compressible": false,
    "extensions": ["jpeg","jpg","jpe"]
  },
  "image/jpm": {
    "source": "iana"
  },
  "image/jpx": {
    "source": "iana"
  },
  "image/ktx": {
    "source": "iana",
    "extensions": ["ktx"]
  },
  "image/naplps": {
    "source": "iana"
  },
  "image/pjpeg": {
    "compressible": false
  },
  "image/png": {
    "source": "iana",
    "compressible": false,
    "extensions": ["png"]
  },
  "image/prs.btif": {
    "source": "iana",
    "extensions": ["btif"]
  },
  "image/prs.pti": {
    "source": "iana"
  },
  "image/pwg-raster": {
    "source": "iana"
  },
  "image/sgi": {
    "source": "apache",
    "extensions": ["sgi"]
  },
  "image/svg+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["svg","svgz"]
  },
  "image/t38": {
    "source": "iana"
  },
  "image/tiff": {
    "source": "iana",
    "compressible": false,
    "extensions": ["tiff","tif"]
  },
  "image/tiff-fx": {
    "source": "iana"
  },
  "image/vnd.adobe.photoshop": {
    "source": "iana",
    "compressible": true,
    "extensions": ["psd"]
  },
  "image/vnd.airzip.accelerator.azv": {
    "source": "iana"
  },
  "image/vnd.cns.inf2": {
    "source": "iana"
  },
  "image/vnd.dece.graphic": {
    "source": "iana",
    "extensions": ["uvi","uvvi","uvg","uvvg"]
  },
  "image/vnd.djvu": {
    "source": "iana",
    "extensions": ["djvu","djv"]
  },
  "image/vnd.dvb.subtitle": {
    "source": "iana",
    "extensions": ["sub"]
  },
  "image/vnd.dwg": {
    "source": "iana",
    "extensions": ["dwg"]
  },
  "image/vnd.dxf": {
    "source": "iana",
    "extensions": ["dxf"]
  },
  "image/vnd.fastbidsheet": {
    "source": "iana",
    "extensions": ["fbs"]
  },
  "image/vnd.fpx": {
    "source": "iana",
    "extensions": ["fpx"]
  },
  "image/vnd.fst": {
    "source": "iana",
    "extensions": ["fst"]
  },
  "image/vnd.fujixerox.edmics-mmr": {
    "source": "iana",
    "extensions": ["mmr"]
  },
  "image/vnd.fujixerox.edmics-rlc": {
    "source": "iana",
    "extensions": ["rlc"]
  },
  "image/vnd.globalgraphics.pgb": {
    "source": "iana"
  },
  "image/vnd.microsoft.icon": {
    "source": "iana"
  },
  "image/vnd.mix": {
    "source": "iana"
  },
  "image/vnd.mozilla.apng": {
    "source": "iana"
  },
  "image/vnd.ms-modi": {
    "source": "iana",
    "extensions": ["mdi"]
  },
  "image/vnd.ms-photo": {
    "source": "apache",
    "extensions": ["wdp"]
  },
  "image/vnd.net-fpx": {
    "source": "iana",
    "extensions": ["npx"]
  },
  "image/vnd.radiance": {
    "source": "iana"
  },
  "image/vnd.sealed.png": {
    "source": "iana"
  },
  "image/vnd.sealedmedia.softseal.gif": {
    "source": "iana"
  },
  "image/vnd.sealedmedia.softseal.jpg": {
    "source": "iana"
  },
  "image/vnd.svf": {
    "source": "iana"
  },
  "image/vnd.tencent.tap": {
    "source": "iana"
  },
  "image/vnd.valve.source.texture": {
    "source": "iana"
  },
  "image/vnd.wap.wbmp": {
    "source": "iana",
    "extensions": ["wbmp"]
  },
  "image/vnd.xiff": {
    "source": "iana",
    "extensions": ["xif"]
  },
  "image/vnd.zbrush.pcx": {
    "source": "iana"
  },
  "image/webp": {
    "source": "apache",
    "extensions": ["webp"]
  },
  "image/wmf": {
    "source": "iana"
  },
  "image/x-3ds": {
    "source": "apache",
    "extensions": ["3ds"]
  },
  "image/x-cmu-raster": {
    "source": "apache",
    "extensions": ["ras"]
  },
  "image/x-cmx": {
    "source": "apache",
    "extensions": ["cmx"]
  },
  "image/x-freehand": {
    "source": "apache",
    "extensions": ["fh","fhc","fh4","fh5","fh7"]
  },
  "image/x-icon": {
    "source": "apache",
    "compressible": true,
    "extensions": ["ico"]
  },
  "image/x-jng": {
    "source": "nginx",
    "extensions": ["jng"]
  },
  "image/x-mrsid-image": {
    "source": "apache",
    "extensions": ["sid"]
  },
  "image/x-ms-bmp": {
    "source": "nginx",
    "compressible": true,
    "extensions": ["bmp"]
  },
  "image/x-pcx": {
    "source": "apache",
    "extensions": ["pcx"]
  },
  "image/x-pict": {
    "source": "apache",
    "extensions": ["pic","pct"]
  },
  "image/x-portable-anymap": {
    "source": "apache",
    "extensions": ["pnm"]
  },
  "image/x-portable-bitmap": {
    "source": "apache",
    "extensions": ["pbm"]
  },
  "image/x-portable-graymap": {
    "source": "apache",
    "extensions": ["pgm"]
  },
  "image/x-portable-pixmap": {
    "source": "apache",
    "extensions": ["ppm"]
  },
  "image/x-rgb": {
    "source": "apache",
    "extensions": ["rgb"]
  },
  "image/x-tga": {
    "source": "apache",
    "extensions": ["tga"]
  },
  "image/x-xbitmap": {
    "source": "apache",
    "extensions": ["xbm"]
  },
  "image/x-xcf": {
    "compressible": false
  },
  "image/x-xpixmap": {
    "source": "apache",
    "extensions": ["xpm"]
  },
  "image/x-xwindowdump": {
    "source": "apache",
    "extensions": ["xwd"]
  },
  "message/cpim": {
    "source": "iana"
  },
  "message/delivery-status": {
    "source": "iana"
  },
  "message/disposition-notification": {
    "source": "iana"
  },
  "message/external-body": {
    "source": "iana"
  },
  "message/feedback-report": {
    "source": "iana"
  },
  "message/global": {
    "source": "iana"
  },
  "message/global-delivery-status": {
    "source": "iana"
  },
  "message/global-disposition-notification": {
    "source": "iana"
  },
  "message/global-headers": {
    "source": "iana"
  },
  "message/http": {
    "source": "iana",
    "compressible": false
  },
  "message/imdn+xml": {
    "source": "iana",
    "compressible": true
  },
  "message/news": {
    "source": "iana"
  },
  "message/partial": {
    "source": "iana",
    "compressible": false
  },
  "message/rfc822": {
    "source": "iana",
    "compressible": true,
    "extensions": ["eml","mime"]
  },
  "message/s-http": {
    "source": "iana"
  },
  "message/sip": {
    "source": "iana"
  },
  "message/sipfrag": {
    "source": "iana"
  },
  "message/tracking-status": {
    "source": "iana"
  },
  "message/vnd.si.simp": {
    "source": "iana"
  },
  "message/vnd.wfa.wsc": {
    "source": "iana"
  },
  "model/gltf+json": {
    "source": "iana",
    "compressible": true
  },
  "model/iges": {
    "source": "iana",
    "compressible": false,
    "extensions": ["igs","iges"]
  },
  "model/mesh": {
    "source": "iana",
    "compressible": false,
    "extensions": ["msh","mesh","silo"]
  },
  "model/vnd.collada+xml": {
    "source": "iana",
    "extensions": ["dae"]
  },
  "model/vnd.dwf": {
    "source": "iana",
    "extensions": ["dwf"]
  },
  "model/vnd.flatland.3dml": {
    "source": "iana"
  },
  "model/vnd.gdl": {
    "source": "iana",
    "extensions": ["gdl"]
  },
  "model/vnd.gs-gdl": {
    "source": "apache"
  },
  "model/vnd.gs.gdl": {
    "source": "iana"
  },
  "model/vnd.gtw": {
    "source": "iana",
    "extensions": ["gtw"]
  },
  "model/vnd.moml+xml": {
    "source": "iana"
  },
  "model/vnd.mts": {
    "source": "iana",
    "extensions": ["mts"]
  },
  "model/vnd.opengex": {
    "source": "iana"
  },
  "model/vnd.parasolid.transmit.binary": {
    "source": "iana"
  },
  "model/vnd.parasolid.transmit.text": {
    "source": "iana"
  },
  "model/vnd.rosette.annotated-data-model": {
    "source": "iana"
  },
  "model/vnd.valve.source.compiled-map": {
    "source": "iana"
  },
  "model/vnd.vtu": {
    "source": "iana",
    "extensions": ["vtu"]
  },
  "model/vrml": {
    "source": "iana",
    "compressible": false,
    "extensions": ["wrl","vrml"]
  },
  "model/x3d+binary": {
    "source": "apache",
    "compressible": false,
    "extensions": ["x3db","x3dbz"]
  },
  "model/x3d+fastinfoset": {
    "source": "iana"
  },
  "model/x3d+vrml": {
    "source": "apache",
    "compressible": false,
    "extensions": ["x3dv","x3dvz"]
  },
  "model/x3d+xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["x3d","x3dz"]
  },
  "model/x3d-vrml": {
    "source": "iana"
  },
  "multipart/alternative": {
    "source": "iana",
    "compressible": false
  },
  "multipart/appledouble": {
    "source": "iana"
  },
  "multipart/byteranges": {
    "source": "iana"
  },
  "multipart/digest": {
    "source": "iana"
  },
  "multipart/encrypted": {
    "source": "iana",
    "compressible": false
  },
  "multipart/form-data": {
    "source": "iana",
    "compressible": false
  },
  "multipart/header-set": {
    "source": "iana"
  },
  "multipart/mixed": {
    "source": "iana",
    "compressible": false
  },
  "multipart/parallel": {
    "source": "iana"
  },
  "multipart/related": {
    "source": "iana",
    "compressible": false
  },
  "multipart/report": {
    "source": "iana"
  },
  "multipart/signed": {
    "source": "iana",
    "compressible": false
  },
  "multipart/voice-message": {
    "source": "iana"
  },
  "multipart/x-mixed-replace": {
    "source": "iana"
  },
  "text/1d-interleaved-parityfec": {
    "source": "iana"
  },
  "text/cache-manifest": {
    "source": "iana",
    "compressible": true,
    "extensions": ["appcache","manifest"]
  },
  "text/calendar": {
    "source": "iana",
    "extensions": ["ics","ifb"]
  },
  "text/calender": {
    "compressible": true
  },
  "text/cmd": {
    "compressible": true
  },
  "text/coffeescript": {
    "extensions": ["coffee","litcoffee"]
  },
  "text/css": {
    "source": "iana",
    "compressible": true,
    "extensions": ["css"]
  },
  "text/csv": {
    "source": "iana",
    "compressible": true,
    "extensions": ["csv"]
  },
  "text/csv-schema": {
    "source": "iana"
  },
  "text/directory": {
    "source": "iana"
  },
  "text/dns": {
    "source": "iana"
  },
  "text/ecmascript": {
    "source": "iana"
  },
  "text/encaprtp": {
    "source": "iana"
  },
  "text/enriched": {
    "source": "iana"
  },
  "text/fwdred": {
    "source": "iana"
  },
  "text/grammar-ref-list": {
    "source": "iana"
  },
  "text/hjson": {
    "extensions": ["hjson"]
  },
  "text/html": {
    "source": "iana",
    "compressible": true,
    "extensions": ["html","htm","shtml"]
  },
  "text/jade": {
    "extensions": ["jade"]
  },
  "text/javascript": {
    "source": "iana",
    "compressible": true
  },
  "text/jcr-cnd": {
    "source": "iana"
  },
  "text/jsx": {
    "compressible": true,
    "extensions": ["jsx"]
  },
  "text/less": {
    "extensions": ["less"]
  },
  "text/markdown": {
    "source": "iana"
  },
  "text/mathml": {
    "source": "nginx",
    "extensions": ["mml"]
  },
  "text/mizar": {
    "source": "iana"
  },
  "text/n3": {
    "source": "iana",
    "compressible": true,
    "extensions": ["n3"]
  },
  "text/parameters": {
    "source": "iana"
  },
  "text/parityfec": {
    "source": "iana"
  },
  "text/plain": {
    "source": "iana",
    "compressible": true,
    "extensions": ["txt","text","conf","def","list","log","in","ini"]
  },
  "text/provenance-notation": {
    "source": "iana"
  },
  "text/prs.fallenstein.rst": {
    "source": "iana"
  },
  "text/prs.lines.tag": {
    "source": "iana",
    "extensions": ["dsc"]
  },
  "text/prs.prop.logic": {
    "source": "iana"
  },
  "text/raptorfec": {
    "source": "iana"
  },
  "text/red": {
    "source": "iana"
  },
  "text/rfc822-headers": {
    "source": "iana"
  },
  "text/richtext": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtx"]
  },
  "text/rtf": {
    "source": "iana",
    "compressible": true,
    "extensions": ["rtf"]
  },
  "text/rtp-enc-aescm128": {
    "source": "iana"
  },
  "text/rtploopback": {
    "source": "iana"
  },
  "text/rtx": {
    "source": "iana"
  },
  "text/sgml": {
    "source": "iana",
    "extensions": ["sgml","sgm"]
  },
  "text/slim": {
    "extensions": ["slim","slm"]
  },
  "text/stylus": {
    "extensions": ["stylus","styl"]
  },
  "text/t140": {
    "source": "iana"
  },
  "text/tab-separated-values": {
    "source": "iana",
    "compressible": true,
    "extensions": ["tsv"]
  },
  "text/troff": {
    "source": "iana",
    "extensions": ["t","tr","roff","man","me","ms"]
  },
  "text/turtle": {
    "source": "iana",
    "extensions": ["ttl"]
  },
  "text/ulpfec": {
    "source": "iana"
  },
  "text/uri-list": {
    "source": "iana",
    "compressible": true,
    "extensions": ["uri","uris","urls"]
  },
  "text/vcard": {
    "source": "iana",
    "compressible": true,
    "extensions": ["vcard"]
  },
  "text/vnd.a": {
    "source": "iana"
  },
  "text/vnd.abc": {
    "source": "iana"
  },
  "text/vnd.ascii-art": {
    "source": "iana"
  },
  "text/vnd.curl": {
    "source": "iana",
    "extensions": ["curl"]
  },
  "text/vnd.curl.dcurl": {
    "source": "apache",
    "extensions": ["dcurl"]
  },
  "text/vnd.curl.mcurl": {
    "source": "apache",
    "extensions": ["mcurl"]
  },
  "text/vnd.curl.scurl": {
    "source": "apache",
    "extensions": ["scurl"]
  },
  "text/vnd.debian.copyright": {
    "source": "iana"
  },
  "text/vnd.dmclientscript": {
    "source": "iana"
  },
  "text/vnd.dvb.subtitle": {
    "source": "iana",
    "extensions": ["sub"]
  },
  "text/vnd.esmertec.theme-descriptor": {
    "source": "iana"
  },
  "text/vnd.fly": {
    "source": "iana",
    "extensions": ["fly"]
  },
  "text/vnd.fmi.flexstor": {
    "source": "iana",
    "extensions": ["flx"]
  },
  "text/vnd.graphviz": {
    "source": "iana",
    "extensions": ["gv"]
  },
  "text/vnd.in3d.3dml": {
    "source": "iana",
    "extensions": ["3dml"]
  },
  "text/vnd.in3d.spot": {
    "source": "iana",
    "extensions": ["spot"]
  },
  "text/vnd.iptc.newsml": {
    "source": "iana"
  },
  "text/vnd.iptc.nitf": {
    "source": "iana"
  },
  "text/vnd.latex-z": {
    "source": "iana"
  },
  "text/vnd.motorola.reflex": {
    "source": "iana"
  },
  "text/vnd.ms-mediapackage": {
    "source": "iana"
  },
  "text/vnd.net2phone.commcenter.command": {
    "source": "iana"
  },
  "text/vnd.radisys.msml-basic-layout": {
    "source": "iana"
  },
  "text/vnd.si.uricatalogue": {
    "source": "iana"
  },
  "text/vnd.sun.j2me.app-descriptor": {
    "source": "iana",
    "extensions": ["jad"]
  },
  "text/vnd.trolltech.linguist": {
    "source": "iana"
  },
  "text/vnd.wap.si": {
    "source": "iana"
  },
  "text/vnd.wap.sl": {
    "source": "iana"
  },
  "text/vnd.wap.wml": {
    "source": "iana",
    "extensions": ["wml"]
  },
  "text/vnd.wap.wmlscript": {
    "source": "iana",
    "extensions": ["wmls"]
  },
  "text/vtt": {
    "charset": "UTF-8",
    "compressible": true,
    "extensions": ["vtt"]
  },
  "text/x-asm": {
    "source": "apache",
    "extensions": ["s","asm"]
  },
  "text/x-c": {
    "source": "apache",
    "extensions": ["c","cc","cxx","cpp","h","hh","dic"]
  },
  "text/x-component": {
    "source": "nginx",
    "extensions": ["htc"]
  },
  "text/x-fortran": {
    "source": "apache",
    "extensions": ["f","for","f77","f90"]
  },
  "text/x-gwt-rpc": {
    "compressible": true
  },
  "text/x-handlebars-template": {
    "extensions": ["hbs"]
  },
  "text/x-java-source": {
    "source": "apache",
    "extensions": ["java"]
  },
  "text/x-jquery-tmpl": {
    "compressible": true
  },
  "text/x-lua": {
    "extensions": ["lua"]
  },
  "text/x-markdown": {
    "compressible": true,
    "extensions": ["markdown","md","mkd"]
  },
  "text/x-nfo": {
    "source": "apache",
    "extensions": ["nfo"]
  },
  "text/x-opml": {
    "source": "apache",
    "extensions": ["opml"]
  },
  "text/x-pascal": {
    "source": "apache",
    "extensions": ["p","pas"]
  },
  "text/x-processing": {
    "compressible": true,
    "extensions": ["pde"]
  },
  "text/x-sass": {
    "extensions": ["sass"]
  },
  "text/x-scss": {
    "extensions": ["scss"]
  },
  "text/x-setext": {
    "source": "apache",
    "extensions": ["etx"]
  },
  "text/x-sfv": {
    "source": "apache",
    "extensions": ["sfv"]
  },
  "text/x-suse-ymp": {
    "compressible": true,
    "extensions": ["ymp"]
  },
  "text/x-uuencode": {
    "source": "apache",
    "extensions": ["uu"]
  },
  "text/x-vcalendar": {
    "source": "apache",
    "extensions": ["vcs"]
  },
  "text/x-vcard": {
    "source": "apache",
    "extensions": ["vcf"]
  },
  "text/xml": {
    "source": "iana",
    "compressible": true,
    "extensions": ["xml"]
  },
  "text/xml-external-parsed-entity": {
    "source": "iana"
  },
  "text/yaml": {
    "extensions": ["yaml","yml"]
  },
  "video/1d-interleaved-parityfec": {
    "source": "apache"
  },
  "video/3gpp": {
    "source": "apache",
    "extensions": ["3gp","3gpp"]
  },
  "video/3gpp-tt": {
    "source": "apache"
  },
  "video/3gpp2": {
    "source": "apache",
    "extensions": ["3g2"]
  },
  "video/bmpeg": {
    "source": "apache"
  },
  "video/bt656": {
    "source": "apache"
  },
  "video/celb": {
    "source": "apache"
  },
  "video/dv": {
    "source": "apache"
  },
  "video/encaprtp": {
    "source": "apache"
  },
  "video/h261": {
    "source": "apache",
    "extensions": ["h261"]
  },
  "video/h263": {
    "source": "apache",
    "extensions": ["h263"]
  },
  "video/h263-1998": {
    "source": "apache"
  },
  "video/h263-2000": {
    "source": "apache"
  },
  "video/h264": {
    "source": "apache",
    "extensions": ["h264"]
  },
  "video/h264-rcdo": {
    "source": "apache"
  },
  "video/h264-svc": {
    "source": "apache"
  },
  "video/h265": {
    "source": "apache"
  },
  "video/iso.segment": {
    "source": "apache"
  },
  "video/jpeg": {
    "source": "apache",
    "extensions": ["jpgv"]
  },
  "video/jpeg2000": {
    "source": "apache"
  },
  "video/jpm": {
    "source": "apache",
    "extensions": ["jpm","jpgm"]
  },
  "video/mj2": {
    "source": "apache",
    "extensions": ["mj2","mjp2"]
  },
  "video/mp1s": {
    "source": "apache"
  },
  "video/mp2p": {
    "source": "apache"
  },
  "video/mp2t": {
    "source": "apache",
    "extensions": ["ts"]
  },
  "video/mp4": {
    "source": "apache",
    "compressible": false,
    "extensions": ["mp4","mp4v","mpg4"]
  },
  "video/mp4v-es": {
    "source": "apache"
  },
  "video/mpeg": {
    "source": "apache",
    "compressible": false,
    "extensions": ["mpeg","mpg","mpe","m1v","m2v"]
  },
  "video/mpeg4-generic": {
    "source": "apache"
  },
  "video/mpv": {
    "source": "apache"
  },
  "video/nv": {
    "source": "apache"
  },
  "video/ogg": {
    "source": "apache",
    "compressible": false,
    "extensions": ["ogv"]
  },
  "video/parityfec": {
    "source": "apache"
  },
  "video/pointer": {
    "source": "apache"
  },
  "video/quicktime": {
    "source": "apache",
    "compressible": false,
    "extensions": ["qt","mov"]
  },
  "video/raptorfec": {
    "source": "apache"
  },
  "video/raw": {
    "source": "apache"
  },
  "video/rtp-enc-aescm128": {
    "source": "apache"
  },
  "video/rtploopback": {
    "source": "apache"
  },
  "video/rtx": {
    "source": "apache"
  },
  "video/smpte292m": {
    "source": "apache"
  },
  "video/ulpfec": {
    "source": "apache"
  },
  "video/vc1": {
    "source": "apache"
  },
  "video/vnd.cctv": {
    "source": "apache"
  },
  "video/vnd.dece.hd": {
    "source": "apache",
    "extensions": ["uvh","uvvh"]
  },
  "video/vnd.dece.mobile": {
    "source": "apache",
    "extensions": ["uvm","uvvm"]
  },
  "video/vnd.dece.mp4": {
    "source": "apache"
  },
  "video/vnd.dece.pd": {
    "source": "apache",
    "extensions": ["uvp","uvvp"]
  },
  "video/vnd.dece.sd": {
    "source": "apache",
    "extensions": ["uvs","uvvs"]
  },
  "video/vnd.dece.video": {
    "source": "apache",
    "extensions": ["uvv","uvvv"]
  },
  "video/vnd.directv.mpeg": {
    "source": "apache"
  },
  "video/vnd.directv.mpeg-tts": {
    "source": "apache"
  },
  "video/vnd.dlna.mpeg-tts": {
    "source": "apache"
  },
  "video/vnd.dvb.file": {
    "source": "apache",
    "extensions": ["dvb"]
  },
  "video/vnd.fvt": {
    "source": "apache",
    "extensions": ["fvt"]
  },
  "video/vnd.hns.video": {
    "source": "apache"
  },
  "video/vnd.iptvforum.1dparityfec-1010": {
    "source": "apache"
  },
  "video/vnd.iptvforum.1dparityfec-2005": {
    "source": "apache"
  },
  "video/vnd.iptvforum.2dparityfec-1010": {
    "source": "apache"
  },
  "video/vnd.iptvforum.2dparityfec-2005": {
    "source": "apache"
  },
  "video/vnd.iptvforum.ttsavc": {
    "source": "apache"
  },
  "video/vnd.iptvforum.ttsmpeg2": {
    "source": "apache"
  },
  "video/vnd.motorola.video": {
    "source": "apache"
  },
  "video/vnd.motorola.videop": {
    "source": "apache"
  },
  "video/vnd.mpegurl": {
    "source": "apache",
    "extensions": ["mxu","m4u"]
  },
  "video/vnd.ms-playready.media.pyv": {
    "source": "apache",
    "extensions": ["pyv"]
  },
  "video/vnd.nokia.interleaved-multimedia": {
    "source": "apache"
  },
  "video/vnd.nokia.videovoip": {
    "source": "apache"
  },
  "video/vnd.objectvideo": {
    "source": "apache"
  },
  "video/vnd.radgamettools.bink": {
    "source": "apache"
  },
  "video/vnd.radgamettools.smacker": {
    "source": "apache"
  },
  "video/vnd.sealed.mpeg1": {
    "source": "apache"
  },
  "video/vnd.sealed.mpeg4": {
    "source": "apache"
  },
  "video/vnd.sealed.swf": {
    "source": "apache"
  },
  "video/vnd.sealedmedia.softseal.mov": {
    "source": "apache"
  },
  "video/vnd.uvvu.mp4": {
    "source": "apache",
    "extensions": ["uvu","uvvu"]
  },
  "video/vnd.vivo": {
    "source": "apache",
    "extensions": ["viv"]
  },
  "video/vp8": {
    "source": "apache"
  },
  "video/webm": {
    "source": "apache",
    "compressible": false,
    "extensions": ["webm"]
  },
  "video/x-f4v": {
    "source": "apache",
    "extensions": ["f4v"]
  },
  "video/x-fli": {
    "source": "apache",
    "extensions": ["fli"]
  },
  "video/x-flv": {
    "source": "apache",
    "compressible": false,
    "extensions": ["flv"]
  },
  "video/x-m4v": {
    "source": "apache",
    "extensions": ["m4v"]
  },
  "video/x-matroska": {
    "source": "apache",
    "compressible": false,
    "extensions": ["mkv","mk3d","mks"]
  },
  "video/x-mng": {
    "source": "apache",
    "extensions": ["mng"]
  },
  "video/x-ms-asf": {
    "source": "apache",
    "extensions": ["asf","asx"]
  },
  "video/x-ms-vob": {
    "source": "apache",
    "extensions": ["vob"]
  },
  "video/x-ms-wm": {
    "source": "apache",
    "extensions": ["wm"]
  },
  "video/x-ms-wmv": {
    "source": "apache",
    "compressible": false,
    "extensions": ["wmv"]
  },
  "video/x-ms-wmx": {
    "source": "apache",
    "extensions": ["wmx"]
  },
  "video/x-ms-wvx": {
    "source": "apache",
    "extensions": ["wvx"]
  },
  "video/x-msvideo": {
    "source": "apache",
    "extensions": ["avi"]
  },
  "video/x-sgi-movie": {
    "source": "apache",
    "extensions": ["movie"]
  },
  "video/x-smv": {
    "source": "apache",
    "extensions": ["smv"]
  },
  "x-conference/x-cooltalk": {
    "source": "apache",
    "extensions": ["ice"]
  },
  "x-shader/x-fragment": {
    "compressible": true
  },
  "x-shader/x-vertex": {
    "compressible": true
  }
}

},{}],11:[function(require,module,exports){
/*!
 * mime-db
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */

/**
 * Module exports.
 */

module.exports = require('./db.json')

},{"./db.json":10}],12:[function(require,module,exports){
/*!
 * mime-types
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var db = require('mime-db')
var extname = require('path').extname

/**
 * Module variables.
 * @private
 */

var extractTypeRegExp = /^\s*([^;\s]*)(?:;|\s|$)/
var textTypeRegExp = /^text\//i

/**
 * Module exports.
 * @public
 */

exports.charset = charset
exports.charsets = { lookup: charset }
exports.contentType = contentType
exports.extension = extension
exports.extensions = Object.create(null)
exports.lookup = lookup
exports.types = Object.create(null)

// Populate the extensions/types maps
populateMaps(exports.extensions, exports.types)

/**
 * Get the default charset for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */

function charset (type) {
  if (!type || typeof type !== 'string') {
    return false
  }

  // TODO: use media-typer
  var match = extractTypeRegExp.exec(type)
  var mime = match && db[match[1].toLowerCase()]

  if (mime && mime.charset) {
    return mime.charset
  }

  // default text/* to utf-8
  if (match && textTypeRegExp.test(match[1])) {
    return 'UTF-8'
  }

  return false
}

/**
 * Create a full Content-Type header given a MIME type or extension.
 *
 * @param {string} str
 * @return {boolean|string}
 */

function contentType (str) {
  // TODO: should this even be in this module?
  if (!str || typeof str !== 'string') {
    return false
  }

  var mime = str.indexOf('/') === -1
    ? exports.lookup(str)
    : str

  if (!mime) {
    return false
  }

  // TODO: use content-type or other module
  if (mime.indexOf('charset') === -1) {
    var charset = exports.charset(mime)
    if (charset) mime += '; charset=' + charset.toLowerCase()
  }

  return mime
}

/**
 * Get the default extension for a MIME type.
 *
 * @param {string} type
 * @return {boolean|string}
 */

function extension (type) {
  if (!type || typeof type !== 'string') {
    return false
  }

  // TODO: use media-typer
  var match = extractTypeRegExp.exec(type)

  // get extensions
  var exts = match && exports.extensions[match[1].toLowerCase()]

  if (!exts || !exts.length) {
    return false
  }

  return exts[0]
}

/**
 * Lookup the MIME type for a file path/extension.
 *
 * @param {string} path
 * @return {boolean|string}
 */

function lookup (path) {
  if (!path || typeof path !== 'string') {
    return false
  }

  // get the extension ("ext" or ".ext" or full path)
  var extension = extname('x.' + path)
    .toLowerCase()
    .substr(1)

  if (!extension) {
    return false
  }

  return exports.types[extension] || false
}

/**
 * Populate the extensions and types maps.
 * @private
 */

function populateMaps (extensions, types) {
  // source preference (least -> most)
  var preference = ['nginx', 'apache', undefined, 'iana']

  Object.keys(db).forEach(function forEachMimeType (type) {
    var mime = db[type]
    var exts = mime.extensions

    if (!exts || !exts.length) {
      return
    }

    // mime -> extensions
    extensions[type] = exts

    // extension -> mime
    for (var i = 0; i < exts.length; i++) {
      var extension = exts[i]

      if (types[extension]) {
        var from = preference.indexOf(db[types[extension]].source)
        var to = preference.indexOf(mime.source)

        if (types[extension] !== 'application/octet-stream' &&
          from > to || (from === to && types[extension].substr(0, 12) === 'application/')) {
          // skip the remapping
          continue
        }
      }

      // set the extension -> mime
      types[extension] = type
    }
  })
}

},{"mime-db":11,"path":13}],13:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":14}],14:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],15:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],17:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],18:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":16,"./encode":17}],19:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":20,"punycode":15,"querystring":18}],20:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],21:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],22:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":21,"_process":14,"inherits":9}],23:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (typeof input === 'string') {
      this.url = input
    } else {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split('\r\n').forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}]},{},[2]);
