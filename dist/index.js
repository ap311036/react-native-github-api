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

},{"util":54}],2:[function(require,module,exports){
(function (process,Buffer){
"use strict";

var error = require("./error");
var mime = require("mime");
var Util = require("./util");
var Url = require("url");
var Promise = require("./promise");

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
var Client = module.exports = function(config) {
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
    var mediaHash  = this.routes.defines.acceptTree;
    var mediaTypes = {};

    for (var accept in mediaHash) {
        for (var route in mediaHash[accept]) {
            mediaTypes[mediaHash[accept][route]] = accept;
        }
    }

    this.acceptUrls = mediaTypes;

    this.setupRoutes();
};

(function() {
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
    this.setupRoutes = function() {
        var self = this;
        var routes = this.routes;
        var defines = routes.defines;
        this.constants = defines.constants;
        this.requestHeaders = defines["request-headers"].map(function(header) {
            return header.toLowerCase();
        });
        this.responseHeaders = defines["response-headers"].map(function(header) {
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
                            } catch(ex) {
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
            Object.keys(struct).forEach(function(routePart) {
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
                        self[Util.toCamelCase("get-" + section + "-api")] = function() {
                            return self[section];
                        };
                    }

                    self[section][funcName] = function(msg, callback) {
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
                                return new self.Promise(function(resolve,reject) {
                                    var cb = function(err, obj) {
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
    this.authenticate = function(options) {
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
        link.replace(/<([^>]*)>;\s*rel="([\w]*)\"/g, function(m, uri, type) {
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
    this.hasNextPage = function(link) {
        return getPageLinks(link).next;
    };

    /**
     *  Client#hasPreviousPage(link) -> null
     *      - link (mixed): response of a request or the contents of the Link header
     *
     *  Check if a request result contains a link to the previous page
     **/
    this.hasPreviousPage = function(link) {
        return getPageLinks(link).prev;
    };

    /**
     *  Client#hasLastPage(link) -> null
     *      - link (mixed): response of a request or the contents of the Link header
     *
     *  Check if a request result contains a link to the last page
     **/
    this.hasLastPage = function(link) {
        return getPageLinks(link).last;
    };

    /**
     *  Client#hasFirstPage(link) -> null
     *      - link (mixed): response of a request or the contents of the Link header
     *
     *  Check if a request result contains a link to the first page
     **/
    this.hasFirstPage = function(link) {
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
                return new self.Promise(function(resolve,reject) {
                    var cb = function(err, obj) {
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
    this.getNextPage = function(link, headers, callback) {
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
    this.getPreviousPage = function(link, headers, callback) {
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
    this.getLastPage = function(link, headers, callback) {
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
    this.getFirstPage = function(link, headers, callback) {
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

        Object.keys(def.params).forEach(function(paramName) {
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
                                        .map(function(part) {
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
    this.httpSend = function(msg, block, callback) {
        var self = this;
        var method = block.method.toLowerCase();
        var hasFileBody = block.hasFileBody;
        var hasBody = !hasFileBody && (typeof(msg.body) !== "undefined" || "head|get|delete".indexOf(method) === -1);
        var format = getRequestFormat.call(this, hasBody, block);
        var obj = getQueryAndUrl(msg, block, format, self.config);
        var query = obj.query;
        var url = this.config.url ? this.config.url + obj.url : obj.url;
        var agent = undefined;

        var path = url;
        var protocol = this.config.protocol || this.constants.protocol || "http";
        var host = block.host || this.config.host || this.constants.host;
        var port = this.config.port || (protocol == "https" ? 443 : 80);
        var proxyUrl;
        var ca = this.config.ca;
        if (this.config.proxy !== undefined) {
            proxyUrl = this.config.proxy;
        } else {
            proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        }
        if (proxyUrl) {
            try {
              var HttpsProxyAgent = require('https-proxy-agent');
              if (HttpsProxyAgent) agent = new HttpsProxyAgent(proxyUrl);
            } catch (e) {
            }
        }
        if (!hasBody && query.length) {
            path += "?" + query.join("&");
        }

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
            Object.keys(customHeaders).forEach(function(header) {
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
            var reqModuleName = self.config.followRedirects === false ? protocol : 'follow-redirects/' + protocol;
            var request;
            try {
              request = (require(reqModuleName) || {}).request;
              if (typeof request !== 'function') throw new Error();

              var req = request(options, function(res) {

                if (self.debug) {
                  console.log("STATUS: " + res.statusCode);
                  console.log("HEADERS: " + JSON.stringify(res.headers));
                }
                res.setEncoding("utf8");
                var data = "";
                res.on("data", function(chunk) {
                  data += chunk;
                });
                res.on("error", function(err) {
                  callCallback(err);
                });
                res.on("end", function() {
                  if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
                    callCallback(new error.HttpError(data, res.statusCode, res.headers));
                  } else {
                    res.data = data;
                    callCallback(null, res);
                  }
                });
              });

              var timeout = (block.timeout !== undefined) ? block.timeout : self.config.timeout;
              if (timeout) {
                req.setTimeout(timeout);
              }

              req.on("error", function(e) {
                if (self.debug) {
                  console.log("problem with request: " + e.message);
                }
                callCallback(e.message);
              });

              req.on("timeout", function() {
                if (self.debug) {
                  console.log("problem with request: timed out");
                }
                req.abort();
                callCallback(new error.GatewayTimeout());
              });

              // write data to request body
              if (hasBody && query.length) {
                if (self.debug) {
                  console.log("REQUEST BODY: " + query + "\n");
                }
                req.write(query + "\n");
              }

              if (block.hasFileBody) {
                try {
                  var fs = require("fs");
                  var stream = fs.createReadStream(msg.filePath);
                  stream.pipe(req);
                } catch(e) {}
              } else {
                req.end();
              }
            } catch(e) {
              require('whatwg-fetch');
              if (typeof fetch !== 'function') throw new Error('Module not found: fetch');

              var httpStr = options.port === 443 ? 'https' : 'http';
              var uri = httpStr + '://' + options.host + options.path;

              // delete options.headers.host;
              // delete options.headers['content-length'];
              // delete options.headers['user-agent'];

              fetch(uri, options).then(function(res) {
                // transform Header into a normal json object
                var headers = {};
                res.headers.forEach(function (value, key) { headers[key] = value; });
                options.headers = headers;

                if (self.debug) {
                  console.log("STATUS: " + res.statusCode);
                  console.log("HEADERS: " + JSON.stringify(res.headers));
                }

                if (res.statusCode >= 400 && res.statusCode < 600 || res.statusCode < 10) {
                  callCallback(new error.HttpError(data, res.statusCode, res.headers));
                } else {
                  res.json().then(function(data) {
                    res.data = data;
                    callCallback(null, res);
                  });
                }
              }).catch(callCallback);
            }
        };

        if (hasFileBody) {
            try {
              var fs = require("fs");
              fs.stat(msg.filePath, function(err, stat) {
                if (err) {
                  callCallback(err);
                } else {
                  headers["content-length"] = stat.size;
                  headers["content-type"] = require("mime").lookup(msg.name);
                  httpSendRequest();
                }
              });
            } catch(e) {
              httpSendRequest();
            }
        } else {
            httpSendRequest();
        }
    };

    this.sendError = function(err, block, msg, callback) {
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

    this.handler = function(msg, block, callback) {
        var self = this;
        this.httpSend(msg, block, function(err, res) {
            if (err) {
                return self.sendError(err, msg, null, callback);
            }

            var ret;
            try {
                var contentType = res.headers["content-type"];
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    ret = res.data && JSON.parse(res.data);
                } else {
                    ret = {data: res.data};
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
            ret.meta = {};
            self.responseHeaders.forEach(function(header) {
                if (res.headers[header]) {
                    ret.meta[header] = res.headers[header];
                }
            });

            if (callback) {
                callback(null, ret);
            }
        });
    }
}).call(Client.prototype);

new Client().activity.getEventsReceived({ username: "brunolemos" }, console.log);

}).call(this,require('_process'),require("buffer").Buffer)
},{"./error":1,"./promise":3,"./routes.json":4,"./util":5,"_process":30,"buffer":12,"fs":10,"https-proxy-agent":20,"mime":25,"url":49,"whatwg-fetch":55}],3:[function(require,module,exports){
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
                "/reactions/:id"
            ],
            
            "application/vnd.github.spiderman-preview": [
                "/repos/:owner/:repo/traffic/popular/referrers",
                "/repos/:owner/:repo/traffic/popular/paths",
                "/repos/:owner/:repo/traffic/views",
                "/repos/:owner/:repo/traffic/clones"
            ],
            
            "application/vnd.github.mockingbird-preview": [
                "/repos/:owner/:repo/issues/:issue_number/timeline"
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
                    "validation": "^(first|last|after:\\d)$",
                    "invalidmsg": "",
                    "description": "Can be one of first, last, or after:<column-id>, where <column-id> is the id value of a column in the same project."
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
                "$base": null
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

        "list-assets": {
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
            "description": "Get the top 10 referrers over the last 14 days. (In preview period. See README.)"
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
            "description": "Get the top 10 popular contents over the last 14 days. (In preview period. See README.)"
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
            "description": "Get the total number of views and breakdown per day or week for the last 14 days. (In preview period. See README.)"
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
            "description": "Get the total number of clones and breakdown per day or week for the last 14 days. (In preview period. See README.)"
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

},{"util":54}],6:[function(require,module,exports){
(function (process){

/**
 * Module dependencies.
 */

require('./patch-core');
var extend = require('extend');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

/**
 * Module exports.
 */

module.exports = Agent;

/**
 * Base `http.Agent` implementation.
 * No pooling/keep-alive is implemented by default.
 *
 * @param {Function} callback
 * @api public
 */

function Agent (callback) {
  if (!(this instanceof Agent)) return new Agent(callback);
  if ('function' != typeof callback) throw new Error('Must pass a "callback function"');
  EventEmitter.call(this);
  this.callback = callback;
}
inherits(Agent, EventEmitter);

/**
 * Called by node-core's "_http_client.js" module when creating
 * a new HTTP request with this Agent instance.
 *
 * @api public
 */

Agent.prototype.addRequest = function (req, host, port, localAddress) {
  var opts;
  if ('object' == typeof host) {
    // >= v0.11.x API
    opts = extend({}, req._options, host);
  } else {
    // <= v0.10.x API
    opts = extend({}, req._options, { host: host, port: port });
    if (null != localAddress) {
      opts.localAddress = localAddress;
    }
  }

  if (opts.host && opts.path) {
    // if both a `host` and `path` are specified then it's most likely the
    // result of a `url.parse()` call... we need to remove the `path` portion so
    // that `net.connect()` doesn't attempt to open that as a unix socket file.
    delete opts.path;
  }

  // set default `port` if none was explicitly specified
  if (null == opts.port) {
    opts.port = opts.secureEndpoint ? 443 : 80;
  }

  delete opts.agent;
  delete opts.hostname;
  delete opts._defaultAgent;
  delete opts.defaultPort;
  delete opts.createConnection;

  // hint to use "Connection: close"
  // XXX: non-documented `http` module API :(
  req._last = true;
  req.shouldKeepAlive = false;

  // clean up a bit of memory since we're no longer using this
  req._options = null;

  // create the `net.Socket` instance
  var sync = true;
  this.callback(req, opts, function (err, socket) {
    function emitErr () {
      req.emit('error', err);
      // For Safety. Some additional errors might fire later on
      // and we need to make sure we don't double-fire the error event.
      req._hadError = true;
    }
    if (err) {
      if (sync) {
        // need to defer the "error" event, when sync, because by now the `req`
        // instance hasn't event been passed back to the user yet...
        process.nextTick(emitErr);
      } else {
        emitErr();
      }
    } else {
      req.onSocket(socket);
    }
  });
  sync = false;
};

}).call(this,require('_process'))
},{"./patch-core":7,"_process":30,"events":17,"extend":18,"util":54}],7:[function(require,module,exports){
(function (process){
var url = require('url');
var http = require('http');
var https = require('https');
var semver = require('semver');
var inherits = require('util').inherits;


// we only need to patch the `http.request()` and
// `http.ClientRequest` on older versions of Node.js
if (semver.lt(process.version, '0.11.8')) {
  // subclass the native ClientRequest to include the
  // passed in `options` object.
  http.ClientRequest = (function (_ClientRequest) {
    function ClientRequest (options, cb) {
      this._options = options;
      _ClientRequest.call(this, options, cb);
    }
    inherits(ClientRequest, _ClientRequest);

    return ClientRequest;
  })(http.ClientRequest);


  // need to re-define the `request()` method, since on node v0.8/v0.10
  // the closure-local ClientRequest is used, rather than the monkey
  // patched version we have created here.
  http.request = (function (request) {
    return function (options, cb) {
      if (typeof options === 'string') {
        options = url.parse(options);
      }
      if (options.protocol && options.protocol !== 'http:') {
        throw new Error('Protocol:' + options.protocol + ' not supported.');
      }
      return new http.ClientRequest(options, cb);
    };
  })(http.request);
}


// this currently needs to be applied to all Node.js versions
// (v0.8.x, v0.10.x, v0.12.x), in order to determine if the `req`
// is an HTTP or HTTPS request. There is currently no PR attempting
// to move this property upstream.
https.request = (function (request) {
  return function (options, cb) {
    if (typeof options === 'string') {
      options = url.parse(options);
    }
    if (null == options.port) options.port = 443;
    options.secureEndpoint = true;
    return request.call(https, options, cb);
  };
})(https.request);

}).call(this,require('_process'))
},{"_process":30,"http":43,"https":19,"semver":42,"url":49,"util":54}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){

},{}],10:[function(require,module,exports){
arguments[4][9][0].apply(exports,arguments)
},{"dup":9}],11:[function(require,module,exports){
(function (global){
'use strict';

var buffer = require('buffer');
var Buffer = buffer.Buffer;
var SlowBuffer = buffer.SlowBuffer;
var MAX_LEN = buffer.kMaxLength || 2147483647;
exports.alloc = function alloc(size, fill, encoding) {
  if (typeof Buffer.alloc === 'function') {
    return Buffer.alloc(size, fill, encoding);
  }
  if (typeof encoding === 'number') {
    throw new TypeError('encoding must not be number');
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  var enc = encoding;
  var _fill = fill;
  if (_fill === undefined) {
    enc = undefined;
    _fill = 0;
  }
  var buf = new Buffer(size);
  if (typeof _fill === 'string') {
    var fillBuf = new Buffer(_fill, enc);
    var flen = fillBuf.length;
    var i = -1;
    while (++i < size) {
      buf[i] = fillBuf[i % flen];
    }
  } else {
    buf.fill(_fill);
  }
  return buf;
}
exports.allocUnsafe = function allocUnsafe(size) {
  if (typeof Buffer.allocUnsafe === 'function') {
    return Buffer.allocUnsafe(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size > MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new Buffer(size);
}
exports.from = function from(value, encodingOrOffset, length) {
  if (typeof Buffer.from === 'function' && (!global.Uint8Array || Uint8Array.from !== Buffer.from)) {
    return Buffer.from(value, encodingOrOffset, length);
  }
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof value === 'string') {
    return new Buffer(value, encodingOrOffset);
  }
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    var offset = encodingOrOffset;
    if (arguments.length === 1) {
      return new Buffer(value);
    }
    if (typeof offset === 'undefined') {
      offset = 0;
    }
    var len = length;
    if (typeof len === 'undefined') {
      len = value.byteLength - offset;
    }
    if (offset >= value.byteLength) {
      throw new RangeError('\'offset\' is out of bounds');
    }
    if (len > value.byteLength - offset) {
      throw new RangeError('\'length\' is out of bounds');
    }
    return new Buffer(value.slice(offset, offset + len));
  }
  if (Buffer.isBuffer(value)) {
    var out = new Buffer(value.length);
    value.copy(out, 0, 0, value.length);
    return out;
  }
  if (value) {
    if (Array.isArray(value) || (typeof ArrayBuffer !== 'undefined' && value.buffer instanceof ArrayBuffer) || 'length' in value) {
      return new Buffer(value);
    }
    if (value.type === 'Buffer' && Array.isArray(value.data)) {
      return new Buffer(value.data);
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ' + 'ArrayBuffer, Array, or array-like object.');
}
exports.allocUnsafeSlow = function allocUnsafeSlow(size) {
  if (typeof Buffer.allocUnsafeSlow === 'function') {
    return Buffer.allocUnsafeSlow(size);
  }
  if (typeof size !== 'number') {
    throw new TypeError('size must be a number');
  }
  if (size >= MAX_LEN) {
    throw new RangeError('size is too large');
  }
  return new SlowBuffer(size);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"buffer":12}],12:[function(require,module,exports){
(function (global){
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
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
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
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
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
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
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
  if (!isArray(list)) {
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
  var length = this.length | 0
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
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
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
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
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

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

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
  offset = offset | 0
  byteLength = byteLength | 0
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
  offset = offset | 0
  byteLength = byteLength | 0
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
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
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
  offset = offset | 0
  byteLength = byteLength | 0
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
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
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
  offset = offset | 0
  byteLength = byteLength | 0
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
  offset = offset | 0
  byteLength = byteLength | 0
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
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
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
  offset = offset | 0
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
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
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
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
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
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":8,"ieee754":21,"isarray":24}],13:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "226": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],14:[function(require,module,exports){
(function (Buffer){
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

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
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
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
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

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":23}],15:[function(require,module,exports){
(function (process){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && 'WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    return exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (typeof process !== 'undefined' && 'env' in process) {
    return process.env.DEBUG;
  }
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":16,"_process":30}],16:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug.debug = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting
    args = exports.formatArgs.apply(self, args);

    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/[\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":27}],17:[function(require,module,exports){
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

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],18:[function(require,module,exports){
'use strict';

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;

var isArray = function isArray(arr) {
	if (typeof Array.isArray === 'function') {
		return Array.isArray(arr);
	}

	return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
	if (!obj || toStr.call(obj) !== '[object Object]') {
		return false;
	}

	var hasOwnConstructor = hasOwn.call(obj, 'constructor');
	var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	// Not own constructor property must be Object
	if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.
	var key;
	for (key in obj) {/**/}

	return typeof key === 'undefined' || hasOwn.call(obj, key);
};

module.exports = function extend() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0],
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if (typeof target === 'boolean') {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
		target = {};
	}

	for (; i < length; ++i) {
		options = arguments[i];
		// Only deal with non-null/undefined values
		if (options != null) {
			// Extend the base object
			for (name in options) {
				src = target[name];
				copy = options[name];

				// Prevent never-ending loop
				if (target !== copy) {
					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (typeof copy !== 'undefined') {
						target[name] = copy;
					}
				}
			}
		}
	}

	// Return the modified object
	return target;
};


},{}],19:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":43}],20:[function(require,module,exports){
(function (Buffer){

/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
var extend = require('extend');
var Agent = require('agent-base');
var inherits = require('util').inherits;
var debug = require('debug')('https-proxy-agent');

/**
 * Module exports.
 */

module.exports = HttpsProxyAgent;

/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to the
 * specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * @api public
 */

function HttpsProxyAgent (opts) {
  if (!(this instanceof HttpsProxyAgent)) return new HttpsProxyAgent(opts);
  if ('string' == typeof opts) opts = url.parse(opts);
  if (!opts) throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
  debug('creating new HttpsProxyAgent instance: %o', opts);
  Agent.call(this, connect);

  var proxy = extend({}, opts);

  // if `true`, then connect to the proxy server over TLS. defaults to `false`.
  this.secureProxy = proxy.protocol ? /^https:?$/i.test(proxy.protocol) : false;

  // prefer `hostname` over `host`, and set the `port` if needed
  proxy.host = proxy.hostname || proxy.host;
  proxy.port = +proxy.port || (this.secureProxy ? 443 : 80);

  if (proxy.host && proxy.path) {
    // if both a `host` and `path` are specified then it's most likely the
    // result of a `url.parse()` call... we need to remove the `path` portion so
    // that `net.connect()` doesn't attempt to open that as a unix socket file.
    delete proxy.path;
    delete proxy.pathname;
  }

  this.proxy = proxy;
}
inherits(HttpsProxyAgent, Agent);

/**
 * Called when the node-core HTTP client library is creating a new HTTP request.
 *
 * @api public
 */

function connect (req, opts, fn) {

  var proxy = this.proxy;

  // create a socket connection to the proxy server
  var socket;
  if (this.secureProxy) {
    socket = tls.connect(proxy);
  } else {
    socket = net.connect(proxy);
  }

  // we need to buffer any HTTP traffic that happens with the proxy before we get
  // the CONNECT response, so that if the response is anything other than an "200"
  // response code, then we can re-play the "data" events on the socket once the
  // HTTP parser is hooked up...
  var buffers = [];
  var buffersLength = 0;

  function read () {
    var b = socket.read();
    if (b) ondata(b);
    else socket.once('readable', read);
  }

  function cleanup () {
    socket.removeListener('data', ondata);
    socket.removeListener('end', onend);
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
    socket.removeListener('readable', read);
  }

  function onclose (err) {
    debug('onclose had error %o', err);
  }

  function onend () {
    debug('onend');
  }

  function onerror (err) {
    cleanup();
    fn(err);
  }

  function ondata (b) {
    buffers.push(b);
    buffersLength += b.length;
    var buffered = Buffer.concat(buffers, buffersLength);
    var str = buffered.toString('ascii');

    if (!~str.indexOf('\r\n\r\n')) {
      // keep buffering
      debug('have not received end of HTTP headers yet...');
      if (socket.read) {
        read();
      } else {
        socket.once('data', ondata);
      }
      return;
    }

    var firstLine = str.substring(0, str.indexOf('\r\n'));
    var statusCode = +firstLine.split(' ')[1];
    debug('got proxy server response: %o', firstLine);

    if (200 == statusCode) {
      // 200 Connected status code!
      var sock = socket;

      // nullify the buffered data since we won't be needing it
      buffers = buffered = null;

      if (opts.secureEndpoint) {
        // since the proxy is connecting to an SSL server, we have
        // to upgrade this socket connection to an SSL connection
        debug('upgrading proxy-connected socket to TLS connection: %o', opts.host);
        opts.socket = socket;
        opts.servername = opts.host;
        opts.host = null;
        opts.hostname = null;
        opts.port = null;
        sock = tls.connect(opts);
      }

      cleanup();
      fn(null, sock);
    } else {
      // some other status code that's not 200... need to re-play the HTTP header
      // "data" events onto the socket once the HTTP machinery is attached so that
      // the user can parse and handle the error status code
      cleanup();

      // save a reference to the concat'd Buffer for the `onsocket` callback
      buffers = buffered;

      // need to wait for the "socket" event to re-play the "data" events
      req.once('socket', onsocket);
      fn(null, socket);
    }
  }

  function onsocket (socket) {
    // replay the "buffers" Buffer onto the `socket`, since at this point
    // the HTTP module machinery has been hooked up for the user
    if ('function' == typeof socket.ondata) {
      // node <= v0.11.3, the `ondata` function is set on the socket
      socket.ondata(buffers, 0, buffers.length);
    } else if (socket.listeners('data').length > 0) {
      // node > v0.11.3, the "data" event is listened for directly
      socket.emit('data', buffers);
    } else {
      // never?
      throw new Error('should not happen...');
    }

    // nullify the cached Buffer instance
    buffers = null;
  }

  socket.on('error', onerror);
  socket.on('close', onclose);
  socket.on('end', onend);

  if (socket.read) {
    read();
  } else {
    socket.once('data', ondata);
  }

  var hostname = opts.host + ':' + opts.port;
  var msg = 'CONNECT ' + hostname + ' HTTP/1.1\r\n';
  var auth = proxy.auth;
  if (auth) {
    msg += 'Proxy-Authorization: Basic ' + new Buffer(auth).toString('base64') + '\r\n';
  }
  msg += 'Host: ' + hostname + '\r\n' +
         'Connection: close\r\n' +
         '\r\n';
  socket.write(msg);
};

}).call(this,require("buffer").Buffer)
},{"agent-base":6,"buffer":12,"debug":15,"extend":18,"net":10,"tls":10,"url":49,"util":54}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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

},{}],23:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],24:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],25:[function(require,module,exports){
(function (process){
var path = require('path');
var fs = require('fs');

function Mime() {
  // Map of extension -> mime type
  this.types = Object.create(null);

  // Map of mime type -> extension
  this.extensions = Object.create(null);
}

/**
 * Define mimetype -> extension mappings.  Each key is a mime-type that maps
 * to an array of extensions associated with the type.  The first extension is
 * used as the default extension for the type.
 *
 * e.g. mime.define({'audio/ogg', ['oga', 'ogg', 'spx']});
 *
 * @param map (Object) type definitions
 */
Mime.prototype.define = function (map) {
  for (var type in map) {
    var exts = map[type];
    for (var i = 0; i < exts.length; i++) {
      if (process.env.DEBUG_MIME && this.types[exts]) {
        console.warn(this._loading.replace(/.*\//, ''), 'changes "' + exts[i] + '" extension type from ' +
          this.types[exts] + ' to ' + type);
      }

      this.types[exts[i]] = type;
    }

    // Default extension is the first one we encounter
    if (!this.extensions[type]) {
      this.extensions[type] = exts[0];
    }
  }
};

/**
 * Load an Apache2-style ".types" file
 *
 * This may be called multiple times (it's expected).  Where files declare
 * overlapping types/extensions, the last file wins.
 *
 * @param file (String) path of file to load.
 */
Mime.prototype.load = function(file) {
  this._loading = file;
  // Read file and split into lines
  var map = {},
      content = fs.readFileSync(file, 'ascii'),
      lines = content.split(/[\r\n]+/);

  lines.forEach(function(line) {
    // Clean up whitespace/comments, and split into fields
    var fields = line.replace(/\s*#.*|^\s*|\s*$/g, '').split(/\s+/);
    map[fields.shift()] = fields;
  });

  this.define(map);

  this._loading = null;
};

/**
 * Lookup a mime type based on extension
 */
Mime.prototype.lookup = function(path, fallback) {
  var ext = path.replace(/.*[\.\/\\]/, '').toLowerCase();

  return this.types[ext] || fallback || this.default_type;
};

/**
 * Return file extension associated with a mime type
 */
Mime.prototype.extension = function(mimeType) {
  var type = mimeType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
  return this.extensions[type];
};

// Default instance
var mime = new Mime();

// Define built-in types
mime.define(require('./types.json'));

// Default type
mime.default_type = mime.lookup('bin');

//
// Additional API specific to the default instance
//

mime.Mime = Mime;

/**
 * Lookup a charset based on mime type.
 */
mime.charsets = {
  lookup: function(mimeType, fallback) {
    // Assume text types are utf8
    return (/^text\//).test(mimeType) ? 'UTF-8' : fallback;
  }
};

module.exports = mime;

}).call(this,require('_process'))
},{"./types.json":26,"_process":30,"fs":10,"path":28}],26:[function(require,module,exports){
module.exports={"application/andrew-inset":["ez"],"application/applixware":["aw"],"application/atom+xml":["atom"],"application/atomcat+xml":["atomcat"],"application/atomsvc+xml":["atomsvc"],"application/ccxml+xml":["ccxml"],"application/cdmi-capability":["cdmia"],"application/cdmi-container":["cdmic"],"application/cdmi-domain":["cdmid"],"application/cdmi-object":["cdmio"],"application/cdmi-queue":["cdmiq"],"application/cu-seeme":["cu"],"application/dash+xml":["mdp"],"application/davmount+xml":["davmount"],"application/docbook+xml":["dbk"],"application/dssc+der":["dssc"],"application/dssc+xml":["xdssc"],"application/ecmascript":["ecma"],"application/emma+xml":["emma"],"application/epub+zip":["epub"],"application/exi":["exi"],"application/font-tdpfr":["pfr"],"application/font-woff":["woff"],"application/font-woff2":["woff2"],"application/gml+xml":["gml"],"application/gpx+xml":["gpx"],"application/gxf":["gxf"],"application/hyperstudio":["stk"],"application/inkml+xml":["ink","inkml"],"application/ipfix":["ipfix"],"application/java-archive":["jar"],"application/java-serialized-object":["ser"],"application/java-vm":["class"],"application/javascript":["js"],"application/json":["json","map"],"application/json5":["json5"],"application/jsonml+json":["jsonml"],"application/lost+xml":["lostxml"],"application/mac-binhex40":["hqx"],"application/mac-compactpro":["cpt"],"application/mads+xml":["mads"],"application/marc":["mrc"],"application/marcxml+xml":["mrcx"],"application/mathematica":["ma","nb","mb"],"application/mathml+xml":["mathml"],"application/mbox":["mbox"],"application/mediaservercontrol+xml":["mscml"],"application/metalink+xml":["metalink"],"application/metalink4+xml":["meta4"],"application/mets+xml":["mets"],"application/mods+xml":["mods"],"application/mp21":["m21","mp21"],"application/mp4":["mp4s","m4p"],"application/msword":["doc","dot"],"application/mxf":["mxf"],"application/octet-stream":["bin","dms","lrf","mar","so","dist","distz","pkg","bpk","dump","elc","deploy","buffer"],"application/oda":["oda"],"application/oebps-package+xml":["opf"],"application/ogg":["ogx"],"application/omdoc+xml":["omdoc"],"application/onenote":["onetoc","onetoc2","onetmp","onepkg"],"application/oxps":["oxps"],"application/patch-ops-error+xml":["xer"],"application/pdf":["pdf"],"application/pgp-encrypted":["pgp"],"application/pgp-signature":["asc","sig"],"application/pics-rules":["prf"],"application/pkcs10":["p10"],"application/pkcs7-mime":["p7m","p7c"],"application/pkcs7-signature":["p7s"],"application/pkcs8":["p8"],"application/pkix-attr-cert":["ac"],"application/pkix-cert":["cer"],"application/pkix-crl":["crl"],"application/pkix-pkipath":["pkipath"],"application/pkixcmp":["pki"],"application/pls+xml":["pls"],"application/postscript":["ai","eps","ps"],"application/prs.cww":["cww"],"application/pskc+xml":["pskcxml"],"application/rdf+xml":["rdf"],"application/reginfo+xml":["rif"],"application/relax-ng-compact-syntax":["rnc"],"application/resource-lists+xml":["rl"],"application/resource-lists-diff+xml":["rld"],"application/rls-services+xml":["rs"],"application/rpki-ghostbusters":["gbr"],"application/rpki-manifest":["mft"],"application/rpki-roa":["roa"],"application/rsd+xml":["rsd"],"application/rss+xml":["rss"],"application/rtf":["rtf"],"application/sbml+xml":["sbml"],"application/scvp-cv-request":["scq"],"application/scvp-cv-response":["scs"],"application/scvp-vp-request":["spq"],"application/scvp-vp-response":["spp"],"application/sdp":["sdp"],"application/set-payment-initiation":["setpay"],"application/set-registration-initiation":["setreg"],"application/shf+xml":["shf"],"application/smil+xml":["smi","smil"],"application/sparql-query":["rq"],"application/sparql-results+xml":["srx"],"application/srgs":["gram"],"application/srgs+xml":["grxml"],"application/sru+xml":["sru"],"application/ssdl+xml":["ssdl"],"application/ssml+xml":["ssml"],"application/tei+xml":["tei","teicorpus"],"application/thraud+xml":["tfi"],"application/timestamped-data":["tsd"],"application/vnd.3gpp.pic-bw-large":["plb"],"application/vnd.3gpp.pic-bw-small":["psb"],"application/vnd.3gpp.pic-bw-var":["pvb"],"application/vnd.3gpp2.tcap":["tcap"],"application/vnd.3m.post-it-notes":["pwn"],"application/vnd.accpac.simply.aso":["aso"],"application/vnd.accpac.simply.imp":["imp"],"application/vnd.acucobol":["acu"],"application/vnd.acucorp":["atc","acutc"],"application/vnd.adobe.air-application-installer-package+zip":["air"],"application/vnd.adobe.formscentral.fcdt":["fcdt"],"application/vnd.adobe.fxp":["fxp","fxpl"],"application/vnd.adobe.xdp+xml":["xdp"],"application/vnd.adobe.xfdf":["xfdf"],"application/vnd.ahead.space":["ahead"],"application/vnd.airzip.filesecure.azf":["azf"],"application/vnd.airzip.filesecure.azs":["azs"],"application/vnd.amazon.ebook":["azw"],"application/vnd.americandynamics.acc":["acc"],"application/vnd.amiga.ami":["ami"],"application/vnd.android.package-archive":["apk"],"application/vnd.anser-web-certificate-issue-initiation":["cii"],"application/vnd.anser-web-funds-transfer-initiation":["fti"],"application/vnd.antix.game-component":["atx"],"application/vnd.apple.installer+xml":["mpkg"],"application/vnd.apple.mpegurl":["m3u8"],"application/vnd.aristanetworks.swi":["swi"],"application/vnd.astraea-software.iota":["iota"],"application/vnd.audiograph":["aep"],"application/vnd.blueice.multipass":["mpm"],"application/vnd.bmi":["bmi"],"application/vnd.businessobjects":["rep"],"application/vnd.chemdraw+xml":["cdxml"],"application/vnd.chipnuts.karaoke-mmd":["mmd"],"application/vnd.cinderella":["cdy"],"application/vnd.claymore":["cla"],"application/vnd.cloanto.rp9":["rp9"],"application/vnd.clonk.c4group":["c4g","c4d","c4f","c4p","c4u"],"application/vnd.cluetrust.cartomobile-config":["c11amc"],"application/vnd.cluetrust.cartomobile-config-pkg":["c11amz"],"application/vnd.commonspace":["csp"],"application/vnd.contact.cmsg":["cdbcmsg"],"application/vnd.cosmocaller":["cmc"],"application/vnd.crick.clicker":["clkx"],"application/vnd.crick.clicker.keyboard":["clkk"],"application/vnd.crick.clicker.palette":["clkp"],"application/vnd.crick.clicker.template":["clkt"],"application/vnd.crick.clicker.wordbank":["clkw"],"application/vnd.criticaltools.wbs+xml":["wbs"],"application/vnd.ctc-posml":["pml"],"application/vnd.cups-ppd":["ppd"],"application/vnd.curl.car":["car"],"application/vnd.curl.pcurl":["pcurl"],"application/vnd.dart":["dart"],"application/vnd.data-vision.rdz":["rdz"],"application/vnd.dece.data":["uvf","uvvf","uvd","uvvd"],"application/vnd.dece.ttml+xml":["uvt","uvvt"],"application/vnd.dece.unspecified":["uvx","uvvx"],"application/vnd.dece.zip":["uvz","uvvz"],"application/vnd.denovo.fcselayout-link":["fe_launch"],"application/vnd.dna":["dna"],"application/vnd.dolby.mlp":["mlp"],"application/vnd.dpgraph":["dpg"],"application/vnd.dreamfactory":["dfac"],"application/vnd.ds-keypoint":["kpxx"],"application/vnd.dvb.ait":["ait"],"application/vnd.dvb.service":["svc"],"application/vnd.dynageo":["geo"],"application/vnd.ecowin.chart":["mag"],"application/vnd.enliven":["nml"],"application/vnd.epson.esf":["esf"],"application/vnd.epson.msf":["msf"],"application/vnd.epson.quickanime":["qam"],"application/vnd.epson.salt":["slt"],"application/vnd.epson.ssf":["ssf"],"application/vnd.eszigno3+xml":["es3","et3"],"application/vnd.ezpix-album":["ez2"],"application/vnd.ezpix-package":["ez3"],"application/vnd.fdf":["fdf"],"application/vnd.fdsn.mseed":["mseed"],"application/vnd.fdsn.seed":["seed","dataless"],"application/vnd.flographit":["gph"],"application/vnd.fluxtime.clip":["ftc"],"application/vnd.framemaker":["fm","frame","maker","book"],"application/vnd.frogans.fnc":["fnc"],"application/vnd.frogans.ltf":["ltf"],"application/vnd.fsc.weblaunch":["fsc"],"application/vnd.fujitsu.oasys":["oas"],"application/vnd.fujitsu.oasys2":["oa2"],"application/vnd.fujitsu.oasys3":["oa3"],"application/vnd.fujitsu.oasysgp":["fg5"],"application/vnd.fujitsu.oasysprs":["bh2"],"application/vnd.fujixerox.ddd":["ddd"],"application/vnd.fujixerox.docuworks":["xdw"],"application/vnd.fujixerox.docuworks.binder":["xbd"],"application/vnd.fuzzysheet":["fzs"],"application/vnd.genomatix.tuxedo":["txd"],"application/vnd.geogebra.file":["ggb"],"application/vnd.geogebra.tool":["ggt"],"application/vnd.geometry-explorer":["gex","gre"],"application/vnd.geonext":["gxt"],"application/vnd.geoplan":["g2w"],"application/vnd.geospace":["g3w"],"application/vnd.gmx":["gmx"],"application/vnd.google-earth.kml+xml":["kml"],"application/vnd.google-earth.kmz":["kmz"],"application/vnd.grafeq":["gqf","gqs"],"application/vnd.groove-account":["gac"],"application/vnd.groove-help":["ghf"],"application/vnd.groove-identity-message":["gim"],"application/vnd.groove-injector":["grv"],"application/vnd.groove-tool-message":["gtm"],"application/vnd.groove-tool-template":["tpl"],"application/vnd.groove-vcard":["vcg"],"application/vnd.hal+xml":["hal"],"application/vnd.handheld-entertainment+xml":["zmm"],"application/vnd.hbci":["hbci"],"application/vnd.hhe.lesson-player":["les"],"application/vnd.hp-hpgl":["hpgl"],"application/vnd.hp-hpid":["hpid"],"application/vnd.hp-hps":["hps"],"application/vnd.hp-jlyt":["jlt"],"application/vnd.hp-pcl":["pcl"],"application/vnd.hp-pclxl":["pclxl"],"application/vnd.ibm.minipay":["mpy"],"application/vnd.ibm.modcap":["afp","listafp","list3820"],"application/vnd.ibm.rights-management":["irm"],"application/vnd.ibm.secure-container":["sc"],"application/vnd.iccprofile":["icc","icm"],"application/vnd.igloader":["igl"],"application/vnd.immervision-ivp":["ivp"],"application/vnd.immervision-ivu":["ivu"],"application/vnd.insors.igm":["igm"],"application/vnd.intercon.formnet":["xpw","xpx"],"application/vnd.intergeo":["i2g"],"application/vnd.intu.qbo":["qbo"],"application/vnd.intu.qfx":["qfx"],"application/vnd.ipunplugged.rcprofile":["rcprofile"],"application/vnd.irepository.package+xml":["irp"],"application/vnd.is-xpr":["xpr"],"application/vnd.isac.fcs":["fcs"],"application/vnd.jam":["jam"],"application/vnd.jcp.javame.midlet-rms":["rms"],"application/vnd.jisp":["jisp"],"application/vnd.joost.joda-archive":["joda"],"application/vnd.kahootz":["ktz","ktr"],"application/vnd.kde.karbon":["karbon"],"application/vnd.kde.kchart":["chrt"],"application/vnd.kde.kformula":["kfo"],"application/vnd.kde.kivio":["flw"],"application/vnd.kde.kontour":["kon"],"application/vnd.kde.kpresenter":["kpr","kpt"],"application/vnd.kde.kspread":["ksp"],"application/vnd.kde.kword":["kwd","kwt"],"application/vnd.kenameaapp":["htke"],"application/vnd.kidspiration":["kia"],"application/vnd.kinar":["kne","knp"],"application/vnd.koan":["skp","skd","skt","skm"],"application/vnd.kodak-descriptor":["sse"],"application/vnd.las.las+xml":["lasxml"],"application/vnd.llamagraphics.life-balance.desktop":["lbd"],"application/vnd.llamagraphics.life-balance.exchange+xml":["lbe"],"application/vnd.lotus-1-2-3":["123"],"application/vnd.lotus-approach":["apr"],"application/vnd.lotus-freelance":["pre"],"application/vnd.lotus-notes":["nsf"],"application/vnd.lotus-organizer":["org"],"application/vnd.lotus-screencam":["scm"],"application/vnd.lotus-wordpro":["lwp"],"application/vnd.macports.portpkg":["portpkg"],"application/vnd.mcd":["mcd"],"application/vnd.medcalcdata":["mc1"],"application/vnd.mediastation.cdkey":["cdkey"],"application/vnd.mfer":["mwf"],"application/vnd.mfmp":["mfm"],"application/vnd.micrografx.flo":["flo"],"application/vnd.micrografx.igx":["igx"],"application/vnd.mif":["mif"],"application/vnd.mobius.daf":["daf"],"application/vnd.mobius.dis":["dis"],"application/vnd.mobius.mbk":["mbk"],"application/vnd.mobius.mqy":["mqy"],"application/vnd.mobius.msl":["msl"],"application/vnd.mobius.plc":["plc"],"application/vnd.mobius.txf":["txf"],"application/vnd.mophun.application":["mpn"],"application/vnd.mophun.certificate":["mpc"],"application/vnd.mozilla.xul+xml":["xul"],"application/vnd.ms-artgalry":["cil"],"application/vnd.ms-cab-compressed":["cab"],"application/vnd.ms-excel":["xls","xlm","xla","xlc","xlt","xlw"],"application/vnd.ms-excel.addin.macroenabled.12":["xlam"],"application/vnd.ms-excel.sheet.binary.macroenabled.12":["xlsb"],"application/vnd.ms-excel.sheet.macroenabled.12":["xlsm"],"application/vnd.ms-excel.template.macroenabled.12":["xltm"],"application/vnd.ms-fontobject":["eot"],"application/vnd.ms-htmlhelp":["chm"],"application/vnd.ms-ims":["ims"],"application/vnd.ms-lrm":["lrm"],"application/vnd.ms-officetheme":["thmx"],"application/vnd.ms-pki.seccat":["cat"],"application/vnd.ms-pki.stl":["stl"],"application/vnd.ms-powerpoint":["ppt","pps","pot"],"application/vnd.ms-powerpoint.addin.macroenabled.12":["ppam"],"application/vnd.ms-powerpoint.presentation.macroenabled.12":["pptm"],"application/vnd.ms-powerpoint.slide.macroenabled.12":["sldm"],"application/vnd.ms-powerpoint.slideshow.macroenabled.12":["ppsm"],"application/vnd.ms-powerpoint.template.macroenabled.12":["potm"],"application/vnd.ms-project":["mpp","mpt"],"application/vnd.ms-word.document.macroenabled.12":["docm"],"application/vnd.ms-word.template.macroenabled.12":["dotm"],"application/vnd.ms-works":["wps","wks","wcm","wdb"],"application/vnd.ms-wpl":["wpl"],"application/vnd.ms-xpsdocument":["xps"],"application/vnd.mseq":["mseq"],"application/vnd.musician":["mus"],"application/vnd.muvee.style":["msty"],"application/vnd.mynfc":["taglet"],"application/vnd.neurolanguage.nlu":["nlu"],"application/vnd.nitf":["ntf","nitf"],"application/vnd.noblenet-directory":["nnd"],"application/vnd.noblenet-sealer":["nns"],"application/vnd.noblenet-web":["nnw"],"application/vnd.nokia.n-gage.data":["ngdat"],"application/vnd.nokia.radio-preset":["rpst"],"application/vnd.nokia.radio-presets":["rpss"],"application/vnd.novadigm.edm":["edm"],"application/vnd.novadigm.edx":["edx"],"application/vnd.novadigm.ext":["ext"],"application/vnd.oasis.opendocument.chart":["odc"],"application/vnd.oasis.opendocument.chart-template":["otc"],"application/vnd.oasis.opendocument.database":["odb"],"application/vnd.oasis.opendocument.formula":["odf"],"application/vnd.oasis.opendocument.formula-template":["odft"],"application/vnd.oasis.opendocument.graphics":["odg"],"application/vnd.oasis.opendocument.graphics-template":["otg"],"application/vnd.oasis.opendocument.image":["odi"],"application/vnd.oasis.opendocument.image-template":["oti"],"application/vnd.oasis.opendocument.presentation":["odp"],"application/vnd.oasis.opendocument.presentation-template":["otp"],"application/vnd.oasis.opendocument.spreadsheet":["ods"],"application/vnd.oasis.opendocument.spreadsheet-template":["ots"],"application/vnd.oasis.opendocument.text":["odt"],"application/vnd.oasis.opendocument.text-master":["odm"],"application/vnd.oasis.opendocument.text-template":["ott"],"application/vnd.oasis.opendocument.text-web":["oth"],"application/vnd.olpc-sugar":["xo"],"application/vnd.oma.dd2+xml":["dd2"],"application/vnd.openofficeorg.extension":["oxt"],"application/vnd.openxmlformats-officedocument.presentationml.presentation":["pptx"],"application/vnd.openxmlformats-officedocument.presentationml.slide":["sldx"],"application/vnd.openxmlformats-officedocument.presentationml.slideshow":["ppsx"],"application/vnd.openxmlformats-officedocument.presentationml.template":["potx"],"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":["xlsx"],"application/vnd.openxmlformats-officedocument.spreadsheetml.template":["xltx"],"application/vnd.openxmlformats-officedocument.wordprocessingml.document":["docx"],"application/vnd.openxmlformats-officedocument.wordprocessingml.template":["dotx"],"application/vnd.osgeo.mapguide.package":["mgp"],"application/vnd.osgi.dp":["dp"],"application/vnd.osgi.subsystem":["esa"],"application/vnd.palm":["pdb","pqa","oprc"],"application/vnd.pawaafile":["paw"],"application/vnd.pg.format":["str"],"application/vnd.pg.osasli":["ei6"],"application/vnd.picsel":["efif"],"application/vnd.pmi.widget":["wg"],"application/vnd.pocketlearn":["plf"],"application/vnd.powerbuilder6":["pbd"],"application/vnd.previewsystems.box":["box"],"application/vnd.proteus.magazine":["mgz"],"application/vnd.publishare-delta-tree":["qps"],"application/vnd.pvi.ptid1":["ptid"],"application/vnd.quark.quarkxpress":["qxd","qxt","qwd","qwt","qxl","qxb"],"application/vnd.realvnc.bed":["bed"],"application/vnd.recordare.musicxml":["mxl"],"application/vnd.recordare.musicxml+xml":["musicxml"],"application/vnd.rig.cryptonote":["cryptonote"],"application/vnd.rim.cod":["cod"],"application/vnd.rn-realmedia":["rm"],"application/vnd.rn-realmedia-vbr":["rmvb"],"application/vnd.route66.link66+xml":["link66"],"application/vnd.sailingtracker.track":["st"],"application/vnd.seemail":["see"],"application/vnd.sema":["sema"],"application/vnd.semd":["semd"],"application/vnd.semf":["semf"],"application/vnd.shana.informed.formdata":["ifm"],"application/vnd.shana.informed.formtemplate":["itp"],"application/vnd.shana.informed.interchange":["iif"],"application/vnd.shana.informed.package":["ipk"],"application/vnd.simtech-mindmapper":["twd","twds"],"application/vnd.smaf":["mmf"],"application/vnd.smart.teacher":["teacher"],"application/vnd.solent.sdkm+xml":["sdkm","sdkd"],"application/vnd.spotfire.dxp":["dxp"],"application/vnd.spotfire.sfs":["sfs"],"application/vnd.stardivision.calc":["sdc"],"application/vnd.stardivision.draw":["sda"],"application/vnd.stardivision.impress":["sdd"],"application/vnd.stardivision.math":["smf"],"application/vnd.stardivision.writer":["sdw","vor"],"application/vnd.stardivision.writer-global":["sgl"],"application/vnd.stepmania.package":["smzip"],"application/vnd.stepmania.stepchart":["sm"],"application/vnd.sun.xml.calc":["sxc"],"application/vnd.sun.xml.calc.template":["stc"],"application/vnd.sun.xml.draw":["sxd"],"application/vnd.sun.xml.draw.template":["std"],"application/vnd.sun.xml.impress":["sxi"],"application/vnd.sun.xml.impress.template":["sti"],"application/vnd.sun.xml.math":["sxm"],"application/vnd.sun.xml.writer":["sxw"],"application/vnd.sun.xml.writer.global":["sxg"],"application/vnd.sun.xml.writer.template":["stw"],"application/vnd.sus-calendar":["sus","susp"],"application/vnd.svd":["svd"],"application/vnd.symbian.install":["sis","sisx"],"application/vnd.syncml+xml":["xsm"],"application/vnd.syncml.dm+wbxml":["bdm"],"application/vnd.syncml.dm+xml":["xdm"],"application/vnd.tao.intent-module-archive":["tao"],"application/vnd.tcpdump.pcap":["pcap","cap","dmp"],"application/vnd.tmobile-livetv":["tmo"],"application/vnd.trid.tpt":["tpt"],"application/vnd.triscape.mxs":["mxs"],"application/vnd.trueapp":["tra"],"application/vnd.ufdl":["ufd","ufdl"],"application/vnd.uiq.theme":["utz"],"application/vnd.umajin":["umj"],"application/vnd.unity":["unityweb"],"application/vnd.uoml+xml":["uoml"],"application/vnd.vcx":["vcx"],"application/vnd.visio":["vsd","vst","vss","vsw"],"application/vnd.visionary":["vis"],"application/vnd.vsf":["vsf"],"application/vnd.wap.wbxml":["wbxml"],"application/vnd.wap.wmlc":["wmlc"],"application/vnd.wap.wmlscriptc":["wmlsc"],"application/vnd.webturbo":["wtb"],"application/vnd.wolfram.player":["nbp"],"application/vnd.wordperfect":["wpd"],"application/vnd.wqd":["wqd"],"application/vnd.wt.stf":["stf"],"application/vnd.xara":["xar"],"application/vnd.xfdl":["xfdl"],"application/vnd.yamaha.hv-dic":["hvd"],"application/vnd.yamaha.hv-script":["hvs"],"application/vnd.yamaha.hv-voice":["hvp"],"application/vnd.yamaha.openscoreformat":["osf"],"application/vnd.yamaha.openscoreformat.osfpvg+xml":["osfpvg"],"application/vnd.yamaha.smaf-audio":["saf"],"application/vnd.yamaha.smaf-phrase":["spf"],"application/vnd.yellowriver-custom-menu":["cmp"],"application/vnd.zul":["zir","zirz"],"application/vnd.zzazz.deck+xml":["zaz"],"application/voicexml+xml":["vxml"],"application/widget":["wgt"],"application/winhlp":["hlp"],"application/wsdl+xml":["wsdl"],"application/wspolicy+xml":["wspolicy"],"application/x-7z-compressed":["7z"],"application/x-abiword":["abw"],"application/x-ace-compressed":["ace"],"application/x-apple-diskimage":["dmg"],"application/x-authorware-bin":["aab","x32","u32","vox"],"application/x-authorware-map":["aam"],"application/x-authorware-seg":["aas"],"application/x-bcpio":["bcpio"],"application/x-bittorrent":["torrent"],"application/x-blorb":["blb","blorb"],"application/x-bzip":["bz"],"application/x-bzip2":["bz2","boz"],"application/x-cbr":["cbr","cba","cbt","cbz","cb7"],"application/x-cdlink":["vcd"],"application/x-cfs-compressed":["cfs"],"application/x-chat":["chat"],"application/x-chess-pgn":["pgn"],"application/x-chrome-extension":["crx"],"application/x-conference":["nsc"],"application/x-cpio":["cpio"],"application/x-csh":["csh"],"application/x-debian-package":["deb","udeb"],"application/x-dgc-compressed":["dgc"],"application/x-director":["dir","dcr","dxr","cst","cct","cxt","w3d","fgd","swa"],"application/x-doom":["wad"],"application/x-dtbncx+xml":["ncx"],"application/x-dtbook+xml":["dtb"],"application/x-dtbresource+xml":["res"],"application/x-dvi":["dvi"],"application/x-envoy":["evy"],"application/x-eva":["eva"],"application/x-font-bdf":["bdf"],"application/x-font-ghostscript":["gsf"],"application/x-font-linux-psf":["psf"],"application/x-font-otf":["otf"],"application/x-font-pcf":["pcf"],"application/x-font-snf":["snf"],"application/x-font-ttf":["ttf","ttc"],"application/x-font-type1":["pfa","pfb","pfm","afm"],"application/x-freearc":["arc"],"application/x-futuresplash":["spl"],"application/x-gca-compressed":["gca"],"application/x-glulx":["ulx"],"application/x-gnumeric":["gnumeric"],"application/x-gramps-xml":["gramps"],"application/x-gtar":["gtar"],"application/x-hdf":["hdf"],"application/x-install-instructions":["install"],"application/x-iso9660-image":["iso"],"application/x-java-jnlp-file":["jnlp"],"application/x-latex":["latex"],"application/x-lua-bytecode":["luac"],"application/x-lzh-compressed":["lzh","lha"],"application/x-mie":["mie"],"application/x-mobipocket-ebook":["prc","mobi"],"application/x-ms-application":["application"],"application/x-ms-shortcut":["lnk"],"application/x-ms-wmd":["wmd"],"application/x-ms-wmz":["wmz"],"application/x-ms-xbap":["xbap"],"application/x-msaccess":["mdb"],"application/x-msbinder":["obd"],"application/x-mscardfile":["crd"],"application/x-msclip":["clp"],"application/x-msdownload":["exe","dll","com","bat","msi"],"application/x-msmediaview":["mvb","m13","m14"],"application/x-msmetafile":["wmf","wmz","emf","emz"],"application/x-msmoney":["mny"],"application/x-mspublisher":["pub"],"application/x-msschedule":["scd"],"application/x-msterminal":["trm"],"application/x-mswrite":["wri"],"application/x-netcdf":["nc","cdf"],"application/x-nzb":["nzb"],"application/x-pkcs12":["p12","pfx"],"application/x-pkcs7-certificates":["p7b","spc"],"application/x-pkcs7-certreqresp":["p7r"],"application/x-rar-compressed":["rar"],"application/x-research-info-systems":["ris"],"application/x-sh":["sh"],"application/x-shar":["shar"],"application/x-shockwave-flash":["swf"],"application/x-silverlight-app":["xap"],"application/x-sql":["sql"],"application/x-stuffit":["sit"],"application/x-stuffitx":["sitx"],"application/x-subrip":["srt"],"application/x-sv4cpio":["sv4cpio"],"application/x-sv4crc":["sv4crc"],"application/x-t3vm-image":["t3"],"application/x-tads":["gam"],"application/x-tar":["tar"],"application/x-tcl":["tcl"],"application/x-tex":["tex"],"application/x-tex-tfm":["tfm"],"application/x-texinfo":["texinfo","texi"],"application/x-tgif":["obj"],"application/x-ustar":["ustar"],"application/x-wais-source":["src"],"application/x-web-app-manifest+json":["webapp"],"application/x-x509-ca-cert":["der","crt"],"application/x-xfig":["fig"],"application/x-xliff+xml":["xlf"],"application/x-xpinstall":["xpi"],"application/x-xz":["xz"],"application/x-zmachine":["z1","z2","z3","z4","z5","z6","z7","z8"],"application/xaml+xml":["xaml"],"application/xcap-diff+xml":["xdf"],"application/xenc+xml":["xenc"],"application/xhtml+xml":["xhtml","xht"],"application/xml":["xml","xsl","xsd"],"application/xml-dtd":["dtd"],"application/xop+xml":["xop"],"application/xproc+xml":["xpl"],"application/xslt+xml":["xslt"],"application/xspf+xml":["xspf"],"application/xv+xml":["mxml","xhvml","xvml","xvm"],"application/yang":["yang"],"application/yin+xml":["yin"],"application/zip":["zip"],"audio/adpcm":["adp"],"audio/basic":["au","snd"],"audio/midi":["mid","midi","kar","rmi"],"audio/mp4":["mp4a","m4a"],"audio/mpeg":["mpga","mp2","mp2a","mp3","m2a","m3a"],"audio/ogg":["oga","ogg","spx"],"audio/s3m":["s3m"],"audio/silk":["sil"],"audio/vnd.dece.audio":["uva","uvva"],"audio/vnd.digital-winds":["eol"],"audio/vnd.dra":["dra"],"audio/vnd.dts":["dts"],"audio/vnd.dts.hd":["dtshd"],"audio/vnd.lucent.voice":["lvp"],"audio/vnd.ms-playready.media.pya":["pya"],"audio/vnd.nuera.ecelp4800":["ecelp4800"],"audio/vnd.nuera.ecelp7470":["ecelp7470"],"audio/vnd.nuera.ecelp9600":["ecelp9600"],"audio/vnd.rip":["rip"],"audio/webm":["weba"],"audio/x-aac":["aac"],"audio/x-aiff":["aif","aiff","aifc"],"audio/x-caf":["caf"],"audio/x-flac":["flac"],"audio/x-matroska":["mka"],"audio/x-mpegurl":["m3u"],"audio/x-ms-wax":["wax"],"audio/x-ms-wma":["wma"],"audio/x-pn-realaudio":["ram","ra"],"audio/x-pn-realaudio-plugin":["rmp"],"audio/x-wav":["wav"],"audio/xm":["xm"],"chemical/x-cdx":["cdx"],"chemical/x-cif":["cif"],"chemical/x-cmdf":["cmdf"],"chemical/x-cml":["cml"],"chemical/x-csml":["csml"],"chemical/x-xyz":["xyz"],"font/opentype":["otf"],"image/bmp":["bmp"],"image/cgm":["cgm"],"image/g3fax":["g3"],"image/gif":["gif"],"image/ief":["ief"],"image/jpeg":["jpeg","jpg","jpe"],"image/ktx":["ktx"],"image/png":["png"],"image/prs.btif":["btif"],"image/sgi":["sgi"],"image/svg+xml":["svg","svgz"],"image/tiff":["tiff","tif"],"image/vnd.adobe.photoshop":["psd"],"image/vnd.dece.graphic":["uvi","uvvi","uvg","uvvg"],"image/vnd.djvu":["djvu","djv"],"image/vnd.dvb.subtitle":["sub"],"image/vnd.dwg":["dwg"],"image/vnd.dxf":["dxf"],"image/vnd.fastbidsheet":["fbs"],"image/vnd.fpx":["fpx"],"image/vnd.fst":["fst"],"image/vnd.fujixerox.edmics-mmr":["mmr"],"image/vnd.fujixerox.edmics-rlc":["rlc"],"image/vnd.ms-modi":["mdi"],"image/vnd.ms-photo":["wdp"],"image/vnd.net-fpx":["npx"],"image/vnd.wap.wbmp":["wbmp"],"image/vnd.xiff":["xif"],"image/webp":["webp"],"image/x-3ds":["3ds"],"image/x-cmu-raster":["ras"],"image/x-cmx":["cmx"],"image/x-freehand":["fh","fhc","fh4","fh5","fh7"],"image/x-icon":["ico"],"image/x-mrsid-image":["sid"],"image/x-pcx":["pcx"],"image/x-pict":["pic","pct"],"image/x-portable-anymap":["pnm"],"image/x-portable-bitmap":["pbm"],"image/x-portable-graymap":["pgm"],"image/x-portable-pixmap":["ppm"],"image/x-rgb":["rgb"],"image/x-tga":["tga"],"image/x-xbitmap":["xbm"],"image/x-xpixmap":["xpm"],"image/x-xwindowdump":["xwd"],"message/rfc822":["eml","mime"],"model/iges":["igs","iges"],"model/mesh":["msh","mesh","silo"],"model/vnd.collada+xml":["dae"],"model/vnd.dwf":["dwf"],"model/vnd.gdl":["gdl"],"model/vnd.gtw":["gtw"],"model/vnd.mts":["mts"],"model/vnd.vtu":["vtu"],"model/vrml":["wrl","vrml"],"model/x3d+binary":["x3db","x3dbz"],"model/x3d+vrml":["x3dv","x3dvz"],"model/x3d+xml":["x3d","x3dz"],"text/cache-manifest":["appcache","manifest"],"text/calendar":["ics","ifb"],"text/coffeescript":["coffee"],"text/css":["css"],"text/csv":["csv"],"text/hjson":["hjson"],"text/html":["html","htm"],"text/jade":["jade"],"text/jsx":["jsx"],"text/less":["less"],"text/n3":["n3"],"text/plain":["txt","text","conf","def","list","log","in","ini"],"text/prs.lines.tag":["dsc"],"text/richtext":["rtx"],"text/sgml":["sgml","sgm"],"text/stylus":["stylus","styl"],"text/tab-separated-values":["tsv"],"text/troff":["t","tr","roff","man","me","ms"],"text/turtle":["ttl"],"text/uri-list":["uri","uris","urls"],"text/vcard":["vcard"],"text/vnd.curl":["curl"],"text/vnd.curl.dcurl":["dcurl"],"text/vnd.curl.mcurl":["mcurl"],"text/vnd.curl.scurl":["scurl"],"text/vnd.dvb.subtitle":["sub"],"text/vnd.fly":["fly"],"text/vnd.fmi.flexstor":["flx"],"text/vnd.graphviz":["gv"],"text/vnd.in3d.3dml":["3dml"],"text/vnd.in3d.spot":["spot"],"text/vnd.sun.j2me.app-descriptor":["jad"],"text/vnd.wap.wml":["wml"],"text/vnd.wap.wmlscript":["wmls"],"text/vtt":["vtt"],"text/x-asm":["s","asm"],"text/x-c":["c","cc","cxx","cpp","h","hh","dic"],"text/x-component":["htc"],"text/x-fortran":["f","for","f77","f90"],"text/x-handlebars-template":["hbs"],"text/x-java-source":["java"],"text/x-lua":["lua"],"text/x-markdown":["markdown","md","mkd"],"text/x-nfo":["nfo"],"text/x-opml":["opml"],"text/x-pascal":["p","pas"],"text/x-sass":["sass"],"text/x-scss":["scss"],"text/x-setext":["etx"],"text/x-sfv":["sfv"],"text/x-uuencode":["uu"],"text/x-vcalendar":["vcs"],"text/x-vcard":["vcf"],"text/yaml":["yaml","yml"],"video/3gpp":["3gp"],"video/3gpp2":["3g2"],"video/h261":["h261"],"video/h263":["h263"],"video/h264":["h264"],"video/jpeg":["jpgv"],"video/jpm":["jpm","jpgm"],"video/mj2":["mj2","mjp2"],"video/mp2t":["ts"],"video/mp4":["mp4","mp4v","mpg4"],"video/mpeg":["mpeg","mpg","mpe","m1v","m2v"],"video/ogg":["ogv"],"video/quicktime":["qt","mov"],"video/vnd.dece.hd":["uvh","uvvh"],"video/vnd.dece.mobile":["uvm","uvvm"],"video/vnd.dece.pd":["uvp","uvvp"],"video/vnd.dece.sd":["uvs","uvvs"],"video/vnd.dece.video":["uvv","uvvv"],"video/vnd.dvb.file":["dvb"],"video/vnd.fvt":["fvt"],"video/vnd.mpegurl":["mxu","m4u"],"video/vnd.ms-playready.media.pyv":["pyv"],"video/vnd.uvvu.mp4":["uvu","uvvu"],"video/vnd.vivo":["viv"],"video/webm":["webm"],"video/x-f4v":["f4v"],"video/x-fli":["fli"],"video/x-flv":["flv"],"video/x-m4v":["m4v"],"video/x-matroska":["mkv","mk3d","mks"],"video/x-mng":["mng"],"video/x-ms-asf":["asf","asx"],"video/x-ms-vob":["vob"],"video/x-ms-wm":["wm"],"video/x-ms-wmv":["wmv"],"video/x-ms-wmx":["wmx"],"video/x-ms-wvx":["wvx"],"video/x-msvideo":["avi"],"video/x-sgi-movie":["movie"],"video/x-smv":["smv"],"x-conference/x-cooltalk":["ice"]}

},{}],27:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000
var m = s * 60
var h = m * 60
var d = h * 24
var y = d * 365.25

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function (val, options) {
  options = options || {}
  var type = typeof val
  if (type === 'string' && val.length > 0) {
    return parse(val)
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ?
			fmtLong(val) :
			fmtShort(val)
  }
  throw new Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val))
}

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str)
  if (str.length > 10000) {
    return
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str)
  if (!match) {
    return
  }
  var n = parseFloat(match[1])
  var type = (match[2] || 'ms').toLowerCase()
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y
    case 'days':
    case 'day':
    case 'd':
      return n * d
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n
    default:
      return undefined
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd'
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h'
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm'
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's'
  }
  return ms + 'ms'
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms'
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name
  }
  return Math.ceil(ms / n) + ' ' + name + 's'
}

},{}],28:[function(require,module,exports){
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
},{"_process":30}],29:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}

}).call(this,require('_process'))
},{"_process":30}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
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
		throw new RangeError(errors[type]);
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
	 * https://tools.ietf.org/html/rfc3492#section-3.4
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
		'version': '1.4.1',
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
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":32,"./encode":33}],35:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
},{"./_stream_readable":37,"./_stream_writable":39,"core-util-is":14,"inherits":22,"process-nextick-args":29}],36:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":38,"core-util-is":14,"inherits":22}],37:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var StringDecoder;

util.inherits(Readable, Stream);

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') {
    return emitter.prependListener(event, fn);
  } else {
    // This is a hack to make sure that our error handler is attached before any
    // userland ones.  NEVER DO THIS. This is here only because this code needs
    // to continue to work with older versions of Node.js that do not include
    // the prependListener() method. The goal is to eventually remove this hack.
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  }
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function') this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = bufferShim.from(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var _e = new Error('stream.unshift() after end event');
      stream.emit('error', _e);
    } else {
      var skipAdd;
      if (state.decoder && !addToFront && !encoding) {
        chunk = state.decoder.write(chunk);
        skipAdd = !state.objectMode && chunk.length === 0;
      }

      if (!addToFront) state.reading = false;

      // Don't add to the buffer if we've decoded to an empty string chunk and
      // we're not in object mode
      if (!skipAdd) {
        // if we want the data now, just emit it.
        if (state.flowing && state.length === 0 && !state.sync) {
          stream.emit('data', chunk);
          stream.read(0);
        } else {
          // update the buffer info.
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

          if (state.needReadable) emitReadable(stream);
        }
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function (ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = bufferShim.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'))
},{"./_stream_duplex":35,"./internal/streams/BufferList":40,"_process":30,"buffer":12,"buffer-shims":11,"core-util-is":14,"events":17,"inherits":22,"isarray":24,"process-nextick-args":29,"string_decoder/":47,"util":9}],38:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er, data) {
      done(stream, er, data);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data !== null && data !== undefined) stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":35,"core-util-is":14,"inherits":22}],39:[function(require,module,exports){
(function (process){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream;
(function () {
  try {
    Stream = require('st' + 'ream');
  } catch (_) {} finally {
    if (!Stream) Stream = require('events').EventEmitter;
  }
})();
/*</replacement>*/

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~ ~this.highWaterMark;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;
  // Always throw error if a null is written
  // if we are not in object mode then throw
  // if it is not a buffer, string, or undefined.
  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = bufferShim.from(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk)) encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) processNextTick(cb, er);else cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
        afterWrite(stream, state, finished, cb);
      }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    while (entry) {
      buffer[count] = entry;
      entry = entry.next;
      count += 1;
    }

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;

  this.finish = function (err) {
    var entry = _this.entry;
    _this.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err);
      entry = entry.next;
    }
    if (state.corkedRequestsFree) {
      state.corkedRequestsFree.next = _this;
    } else {
      state.corkedRequestsFree = _this;
    }
  };
}
}).call(this,require('_process'))
},{"./_stream_duplex":35,"_process":30,"buffer":12,"buffer-shims":11,"core-util-is":14,"events":17,"inherits":22,"process-nextick-args":29,"util-deprecate":51}],40:[function(require,module,exports){
'use strict';

var Buffer = require('buffer').Buffer;
/*<replacement>*/
var bufferShim = require('buffer-shims');
/*</replacement>*/

module.exports = BufferList;

function BufferList() {
  this.head = null;
  this.tail = null;
  this.length = 0;
}

BufferList.prototype.push = function (v) {
  var entry = { data: v, next: null };
  if (this.length > 0) this.tail.next = entry;else this.head = entry;
  this.tail = entry;
  ++this.length;
};

BufferList.prototype.unshift = function (v) {
  var entry = { data: v, next: this.head };
  if (this.length === 0) this.tail = entry;
  this.head = entry;
  ++this.length;
};

BufferList.prototype.shift = function () {
  if (this.length === 0) return;
  var ret = this.head.data;
  if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
  --this.length;
  return ret;
};

BufferList.prototype.clear = function () {
  this.head = this.tail = null;
  this.length = 0;
};

BufferList.prototype.join = function (s) {
  if (this.length === 0) return '';
  var p = this.head;
  var ret = '' + p.data;
  while (p = p.next) {
    ret += s + p.data;
  }return ret;
};

BufferList.prototype.concat = function (n) {
  if (this.length === 0) return bufferShim.alloc(0);
  if (this.length === 1) return this.head.data;
  var ret = bufferShim.allocUnsafe(n >>> 0);
  var p = this.head;
  var i = 0;
  while (p) {
    p.data.copy(ret, i);
    i += p.data.length;
    p = p.next;
  }
  return ret;
};
},{"buffer":12,"buffer-shims":11}],41:[function(require,module,exports){
(function (process){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

if (!process.browser && process.env.READABLE_STREAM === 'disable' && Stream) {
  module.exports = Stream;
}

}).call(this,require('_process'))
},{"./lib/_stream_duplex.js":35,"./lib/_stream_passthrough.js":36,"./lib/_stream_readable.js":37,"./lib/_stream_transform.js":38,"./lib/_stream_writable.js":39,"_process":30}],42:[function(require,module,exports){
(function (process){
exports = module.exports = SemVer;

// The debug function is excluded entirely from the minified version.
/* nomin */ var debug;
/* nomin */ if (typeof process === 'object' &&
    /* nomin */ process.env &&
    /* nomin */ process.env.NODE_DEBUG &&
    /* nomin */ /\bsemver\b/i.test(process.env.NODE_DEBUG))
  /* nomin */ debug = function() {
    /* nomin */ var args = Array.prototype.slice.call(arguments, 0);
    /* nomin */ args.unshift('SEMVER');
    /* nomin */ console.log.apply(console, args);
    /* nomin */ };
/* nomin */ else
  /* nomin */ debug = function() {};

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
exports.SEMVER_SPEC_VERSION = '2.0.0';

var MAX_LENGTH = 256;
var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;

// The actual regexps go on exports.re
var re = exports.re = [];
var src = exports.src = [];
var R = 0;

// The following Regular Expressions can be used for tokenizing,
// validating, and parsing SemVer version strings.

// ## Numeric Identifier
// A single `0`, or a non-zero digit followed by zero or more digits.

var NUMERICIDENTIFIER = R++;
src[NUMERICIDENTIFIER] = '0|[1-9]\\d*';
var NUMERICIDENTIFIERLOOSE = R++;
src[NUMERICIDENTIFIERLOOSE] = '[0-9]+';


// ## Non-numeric Identifier
// Zero or more digits, followed by a letter or hyphen, and then zero or
// more letters, digits, or hyphens.

var NONNUMERICIDENTIFIER = R++;
src[NONNUMERICIDENTIFIER] = '\\d*[a-zA-Z-][a-zA-Z0-9-]*';


// ## Main Version
// Three dot-separated numeric identifiers.

var MAINVERSION = R++;
src[MAINVERSION] = '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')\\.' +
                   '(' + src[NUMERICIDENTIFIER] + ')';

var MAINVERSIONLOOSE = R++;
src[MAINVERSIONLOOSE] = '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')\\.' +
                        '(' + src[NUMERICIDENTIFIERLOOSE] + ')';

// ## Pre-release Version Identifier
// A numeric identifier, or a non-numeric identifier.

var PRERELEASEIDENTIFIER = R++;
src[PRERELEASEIDENTIFIER] = '(?:' + src[NUMERICIDENTIFIER] +
                            '|' + src[NONNUMERICIDENTIFIER] + ')';

var PRERELEASEIDENTIFIERLOOSE = R++;
src[PRERELEASEIDENTIFIERLOOSE] = '(?:' + src[NUMERICIDENTIFIERLOOSE] +
                                 '|' + src[NONNUMERICIDENTIFIER] + ')';


// ## Pre-release Version
// Hyphen, followed by one or more dot-separated pre-release version
// identifiers.

var PRERELEASE = R++;
src[PRERELEASE] = '(?:-(' + src[PRERELEASEIDENTIFIER] +
                  '(?:\\.' + src[PRERELEASEIDENTIFIER] + ')*))';

var PRERELEASELOOSE = R++;
src[PRERELEASELOOSE] = '(?:-?(' + src[PRERELEASEIDENTIFIERLOOSE] +
                       '(?:\\.' + src[PRERELEASEIDENTIFIERLOOSE] + ')*))';

// ## Build Metadata Identifier
// Any combination of digits, letters, or hyphens.

var BUILDIDENTIFIER = R++;
src[BUILDIDENTIFIER] = '[0-9A-Za-z-]+';

// ## Build Metadata
// Plus sign, followed by one or more period-separated build metadata
// identifiers.

var BUILD = R++;
src[BUILD] = '(?:\\+(' + src[BUILDIDENTIFIER] +
             '(?:\\.' + src[BUILDIDENTIFIER] + ')*))';


// ## Full Version String
// A main version, followed optionally by a pre-release version and
// build metadata.

// Note that the only major, minor, patch, and pre-release sections of
// the version string are capturing groups.  The build metadata is not a
// capturing group, because it should not ever be used in version
// comparison.

var FULL = R++;
var FULLPLAIN = 'v?' + src[MAINVERSION] +
                src[PRERELEASE] + '?' +
                src[BUILD] + '?';

src[FULL] = '^' + FULLPLAIN + '$';

// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
// common in the npm registry.
var LOOSEPLAIN = '[v=\\s]*' + src[MAINVERSIONLOOSE] +
                 src[PRERELEASELOOSE] + '?' +
                 src[BUILD] + '?';

var LOOSE = R++;
src[LOOSE] = '^' + LOOSEPLAIN + '$';

var GTLT = R++;
src[GTLT] = '((?:<|>)?=?)';

// Something like "2.*" or "1.2.x".
// Note that "x.x" is a valid xRange identifer, meaning "any version"
// Only the first item is strictly required.
var XRANGEIDENTIFIERLOOSE = R++;
src[XRANGEIDENTIFIERLOOSE] = src[NUMERICIDENTIFIERLOOSE] + '|x|X|\\*';
var XRANGEIDENTIFIER = R++;
src[XRANGEIDENTIFIER] = src[NUMERICIDENTIFIER] + '|x|X|\\*';

var XRANGEPLAIN = R++;
src[XRANGEPLAIN] = '[v=\\s]*(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:\\.(' + src[XRANGEIDENTIFIER] + ')' +
                   '(?:' + src[PRERELEASE] + ')?' +
                   src[BUILD] + '?' +
                   ')?)?';

var XRANGEPLAINLOOSE = R++;
src[XRANGEPLAINLOOSE] = '[v=\\s]*(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:\\.(' + src[XRANGEIDENTIFIERLOOSE] + ')' +
                        '(?:' + src[PRERELEASELOOSE] + ')?' +
                        src[BUILD] + '?' +
                        ')?)?';

var XRANGE = R++;
src[XRANGE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAIN] + '$';
var XRANGELOOSE = R++;
src[XRANGELOOSE] = '^' + src[GTLT] + '\\s*' + src[XRANGEPLAINLOOSE] + '$';

// Tilde ranges.
// Meaning is "reasonably at or greater than"
var LONETILDE = R++;
src[LONETILDE] = '(?:~>?)';

var TILDETRIM = R++;
src[TILDETRIM] = '(\\s*)' + src[LONETILDE] + '\\s+';
re[TILDETRIM] = new RegExp(src[TILDETRIM], 'g');
var tildeTrimReplace = '$1~';

var TILDE = R++;
src[TILDE] = '^' + src[LONETILDE] + src[XRANGEPLAIN] + '$';
var TILDELOOSE = R++;
src[TILDELOOSE] = '^' + src[LONETILDE] + src[XRANGEPLAINLOOSE] + '$';

// Caret ranges.
// Meaning is "at least and backwards compatible with"
var LONECARET = R++;
src[LONECARET] = '(?:\\^)';

var CARETTRIM = R++;
src[CARETTRIM] = '(\\s*)' + src[LONECARET] + '\\s+';
re[CARETTRIM] = new RegExp(src[CARETTRIM], 'g');
var caretTrimReplace = '$1^';

var CARET = R++;
src[CARET] = '^' + src[LONECARET] + src[XRANGEPLAIN] + '$';
var CARETLOOSE = R++;
src[CARETLOOSE] = '^' + src[LONECARET] + src[XRANGEPLAINLOOSE] + '$';

// A simple gt/lt/eq thing, or just "" to indicate "any version"
var COMPARATORLOOSE = R++;
src[COMPARATORLOOSE] = '^' + src[GTLT] + '\\s*(' + LOOSEPLAIN + ')$|^$';
var COMPARATOR = R++;
src[COMPARATOR] = '^' + src[GTLT] + '\\s*(' + FULLPLAIN + ')$|^$';


// An expression to strip any whitespace between the gtlt and the thing
// it modifies, so that `> 1.2.3` ==> `>1.2.3`
var COMPARATORTRIM = R++;
src[COMPARATORTRIM] = '(\\s*)' + src[GTLT] +
                      '\\s*(' + LOOSEPLAIN + '|' + src[XRANGEPLAIN] + ')';

// this one has to use the /g flag
re[COMPARATORTRIM] = new RegExp(src[COMPARATORTRIM], 'g');
var comparatorTrimReplace = '$1$2$3';


// Something like `1.2.3 - 1.2.4`
// Note that these all use the loose form, because they'll be
// checked against either the strict or loose comparator form
// later.
var HYPHENRANGE = R++;
src[HYPHENRANGE] = '^\\s*(' + src[XRANGEPLAIN] + ')' +
                   '\\s+-\\s+' +
                   '(' + src[XRANGEPLAIN] + ')' +
                   '\\s*$';

var HYPHENRANGELOOSE = R++;
src[HYPHENRANGELOOSE] = '^\\s*(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s+-\\s+' +
                        '(' + src[XRANGEPLAINLOOSE] + ')' +
                        '\\s*$';

// Star ranges basically just allow anything at all.
var STAR = R++;
src[STAR] = '(<|>)?=?\\s*\\*';

// Compile to actual regexp objects.
// All are flag-free, unless they were created above with a flag.
for (var i = 0; i < R; i++) {
  debug(i, src[i]);
  if (!re[i])
    re[i] = new RegExp(src[i]);
}

exports.parse = parse;
function parse(version, loose) {
  if (version instanceof SemVer)
    return version;

  if (typeof version !== 'string')
    return null;

  if (version.length > MAX_LENGTH)
    return null;

  var r = loose ? re[LOOSE] : re[FULL];
  if (!r.test(version))
    return null;

  try {
    return new SemVer(version, loose);
  } catch (er) {
    return null;
  }
}

exports.valid = valid;
function valid(version, loose) {
  var v = parse(version, loose);
  return v ? v.version : null;
}


exports.clean = clean;
function clean(version, loose) {
  var s = parse(version.trim().replace(/^[=v]+/, ''), loose);
  return s ? s.version : null;
}

exports.SemVer = SemVer;

function SemVer(version, loose) {
  if (version instanceof SemVer) {
    if (version.loose === loose)
      return version;
    else
      version = version.version;
  } else if (typeof version !== 'string') {
    throw new TypeError('Invalid Version: ' + version);
  }

  if (version.length > MAX_LENGTH)
    throw new TypeError('version is longer than ' + MAX_LENGTH + ' characters')

  if (!(this instanceof SemVer))
    return new SemVer(version, loose);

  debug('SemVer', version, loose);
  this.loose = loose;
  var m = version.trim().match(loose ? re[LOOSE] : re[FULL]);

  if (!m)
    throw new TypeError('Invalid Version: ' + version);

  this.raw = version;

  // these are actually numbers
  this.major = +m[1];
  this.minor = +m[2];
  this.patch = +m[3];

  if (this.major > MAX_SAFE_INTEGER || this.major < 0)
    throw new TypeError('Invalid major version')

  if (this.minor > MAX_SAFE_INTEGER || this.minor < 0)
    throw new TypeError('Invalid minor version')

  if (this.patch > MAX_SAFE_INTEGER || this.patch < 0)
    throw new TypeError('Invalid patch version')

  // numberify any prerelease numeric ids
  if (!m[4])
    this.prerelease = [];
  else
    this.prerelease = m[4].split('.').map(function(id) {
      if (/^[0-9]+$/.test(id)) {
        var num = +id
        if (num >= 0 && num < MAX_SAFE_INTEGER)
          return num
      }
      return id;
    });

  this.build = m[5] ? m[5].split('.') : [];
  this.format();
}

SemVer.prototype.format = function() {
  this.version = this.major + '.' + this.minor + '.' + this.patch;
  if (this.prerelease.length)
    this.version += '-' + this.prerelease.join('.');
  return this.version;
};

SemVer.prototype.inspect = function() {
  return '<SemVer "' + this + '">';
};

SemVer.prototype.toString = function() {
  return this.version;
};

SemVer.prototype.compare = function(other) {
  debug('SemVer.compare', this.version, this.loose, other);
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  return this.compareMain(other) || this.comparePre(other);
};

SemVer.prototype.compareMain = function(other) {
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  return compareIdentifiers(this.major, other.major) ||
         compareIdentifiers(this.minor, other.minor) ||
         compareIdentifiers(this.patch, other.patch);
};

SemVer.prototype.comparePre = function(other) {
  if (!(other instanceof SemVer))
    other = new SemVer(other, this.loose);

  // NOT having a prerelease is > having one
  if (this.prerelease.length && !other.prerelease.length)
    return -1;
  else if (!this.prerelease.length && other.prerelease.length)
    return 1;
  else if (!this.prerelease.length && !other.prerelease.length)
    return 0;

  var i = 0;
  do {
    var a = this.prerelease[i];
    var b = other.prerelease[i];
    debug('prerelease compare', i, a, b);
    if (a === undefined && b === undefined)
      return 0;
    else if (b === undefined)
      return 1;
    else if (a === undefined)
      return -1;
    else if (a === b)
      continue;
    else
      return compareIdentifiers(a, b);
  } while (++i);
};

// preminor will bump the version up to the next minor release, and immediately
// down to pre-release. premajor and prepatch work the same way.
SemVer.prototype.inc = function(release, identifier) {
  switch (release) {
    case 'premajor':
      this.prerelease.length = 0;
      this.patch = 0;
      this.minor = 0;
      this.major++;
      this.inc('pre', identifier);
      break;
    case 'preminor':
      this.prerelease.length = 0;
      this.patch = 0;
      this.minor++;
      this.inc('pre', identifier);
      break;
    case 'prepatch':
      // If this is already a prerelease, it will bump to the next version
      // drop any prereleases that might already exist, since they are not
      // relevant at this point.
      this.prerelease.length = 0;
      this.inc('patch', identifier);
      this.inc('pre', identifier);
      break;
    // If the input is a non-prerelease version, this acts the same as
    // prepatch.
    case 'prerelease':
      if (this.prerelease.length === 0)
        this.inc('patch', identifier);
      this.inc('pre', identifier);
      break;

    case 'major':
      // If this is a pre-major version, bump up to the same major version.
      // Otherwise increment major.
      // 1.0.0-5 bumps to 1.0.0
      // 1.1.0 bumps to 2.0.0
      if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0)
        this.major++;
      this.minor = 0;
      this.patch = 0;
      this.prerelease = [];
      break;
    case 'minor':
      // If this is a pre-minor version, bump up to the same minor version.
      // Otherwise increment minor.
      // 1.2.0-5 bumps to 1.2.0
      // 1.2.1 bumps to 1.3.0
      if (this.patch !== 0 || this.prerelease.length === 0)
        this.minor++;
      this.patch = 0;
      this.prerelease = [];
      break;
    case 'patch':
      // If this is not a pre-release version, it will increment the patch.
      // If it is a pre-release it will bump up to the same patch version.
      // 1.2.0-5 patches to 1.2.0
      // 1.2.0 patches to 1.2.1
      if (this.prerelease.length === 0)
        this.patch++;
      this.prerelease = [];
      break;
    // This probably shouldn't be used publicly.
    // 1.0.0 "pre" would become 1.0.0-0 which is the wrong direction.
    case 'pre':
      if (this.prerelease.length === 0)
        this.prerelease = [0];
      else {
        var i = this.prerelease.length;
        while (--i >= 0) {
          if (typeof this.prerelease[i] === 'number') {
            this.prerelease[i]++;
            i = -2;
          }
        }
        if (i === -1) // didn't increment anything
          this.prerelease.push(0);
      }
      if (identifier) {
        // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
        // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
        if (this.prerelease[0] === identifier) {
          if (isNaN(this.prerelease[1]))
            this.prerelease = [identifier, 0];
        } else
          this.prerelease = [identifier, 0];
      }
      break;

    default:
      throw new Error('invalid increment argument: ' + release);
  }
  this.format();
  this.raw = this.version;
  return this;
};

exports.inc = inc;
function inc(version, release, loose, identifier) {
  if (typeof(loose) === 'string') {
    identifier = loose;
    loose = undefined;
  }

  try {
    return new SemVer(version, loose).inc(release, identifier).version;
  } catch (er) {
    return null;
  }
}

exports.diff = diff;
function diff(version1, version2) {
  if (eq(version1, version2)) {
    return null;
  } else {
    var v1 = parse(version1);
    var v2 = parse(version2);
    if (v1.prerelease.length || v2.prerelease.length) {
      for (var key in v1) {
        if (key === 'major' || key === 'minor' || key === 'patch') {
          if (v1[key] !== v2[key]) {
            return 'pre'+key;
          }
        }
      }
      return 'prerelease';
    }
    for (var key in v1) {
      if (key === 'major' || key === 'minor' || key === 'patch') {
        if (v1[key] !== v2[key]) {
          return key;
        }
      }
    }
  }
}

exports.compareIdentifiers = compareIdentifiers;

var numeric = /^[0-9]+$/;
function compareIdentifiers(a, b) {
  var anum = numeric.test(a);
  var bnum = numeric.test(b);

  if (anum && bnum) {
    a = +a;
    b = +b;
  }

  return (anum && !bnum) ? -1 :
         (bnum && !anum) ? 1 :
         a < b ? -1 :
         a > b ? 1 :
         0;
}

exports.rcompareIdentifiers = rcompareIdentifiers;
function rcompareIdentifiers(a, b) {
  return compareIdentifiers(b, a);
}

exports.major = major;
function major(a, loose) {
  return new SemVer(a, loose).major;
}

exports.minor = minor;
function minor(a, loose) {
  return new SemVer(a, loose).minor;
}

exports.patch = patch;
function patch(a, loose) {
  return new SemVer(a, loose).patch;
}

exports.compare = compare;
function compare(a, b, loose) {
  return new SemVer(a, loose).compare(b);
}

exports.compareLoose = compareLoose;
function compareLoose(a, b) {
  return compare(a, b, true);
}

exports.rcompare = rcompare;
function rcompare(a, b, loose) {
  return compare(b, a, loose);
}

exports.sort = sort;
function sort(list, loose) {
  return list.sort(function(a, b) {
    return exports.compare(a, b, loose);
  });
}

exports.rsort = rsort;
function rsort(list, loose) {
  return list.sort(function(a, b) {
    return exports.rcompare(a, b, loose);
  });
}

exports.gt = gt;
function gt(a, b, loose) {
  return compare(a, b, loose) > 0;
}

exports.lt = lt;
function lt(a, b, loose) {
  return compare(a, b, loose) < 0;
}

exports.eq = eq;
function eq(a, b, loose) {
  return compare(a, b, loose) === 0;
}

exports.neq = neq;
function neq(a, b, loose) {
  return compare(a, b, loose) !== 0;
}

exports.gte = gte;
function gte(a, b, loose) {
  return compare(a, b, loose) >= 0;
}

exports.lte = lte;
function lte(a, b, loose) {
  return compare(a, b, loose) <= 0;
}

exports.cmp = cmp;
function cmp(a, op, b, loose) {
  var ret;
  switch (op) {
    case '===':
      if (typeof a === 'object') a = a.version;
      if (typeof b === 'object') b = b.version;
      ret = a === b;
      break;
    case '!==':
      if (typeof a === 'object') a = a.version;
      if (typeof b === 'object') b = b.version;
      ret = a !== b;
      break;
    case '': case '=': case '==': ret = eq(a, b, loose); break;
    case '!=': ret = neq(a, b, loose); break;
    case '>': ret = gt(a, b, loose); break;
    case '>=': ret = gte(a, b, loose); break;
    case '<': ret = lt(a, b, loose); break;
    case '<=': ret = lte(a, b, loose); break;
    default: throw new TypeError('Invalid operator: ' + op);
  }
  return ret;
}

exports.Comparator = Comparator;
function Comparator(comp, loose) {
  if (comp instanceof Comparator) {
    if (comp.loose === loose)
      return comp;
    else
      comp = comp.value;
  }

  if (!(this instanceof Comparator))
    return new Comparator(comp, loose);

  debug('comparator', comp, loose);
  this.loose = loose;
  this.parse(comp);

  if (this.semver === ANY)
    this.value = '';
  else
    this.value = this.operator + this.semver.version;

  debug('comp', this);
}

var ANY = {};
Comparator.prototype.parse = function(comp) {
  var r = this.loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
  var m = comp.match(r);

  if (!m)
    throw new TypeError('Invalid comparator: ' + comp);

  this.operator = m[1];
  if (this.operator === '=')
    this.operator = '';

  // if it literally is just '>' or '' then allow anything.
  if (!m[2])
    this.semver = ANY;
  else
    this.semver = new SemVer(m[2], this.loose);
};

Comparator.prototype.inspect = function() {
  return '<SemVer Comparator "' + this + '">';
};

Comparator.prototype.toString = function() {
  return this.value;
};

Comparator.prototype.test = function(version) {
  debug('Comparator.test', version, this.loose);

  if (this.semver === ANY)
    return true;

  if (typeof version === 'string')
    version = new SemVer(version, this.loose);

  return cmp(version, this.operator, this.semver, this.loose);
};


exports.Range = Range;
function Range(range, loose) {
  if ((range instanceof Range) && range.loose === loose)
    return range;

  if (!(this instanceof Range))
    return new Range(range, loose);

  this.loose = loose;

  // First, split based on boolean or ||
  this.raw = range;
  this.set = range.split(/\s*\|\|\s*/).map(function(range) {
    return this.parseRange(range.trim());
  }, this).filter(function(c) {
    // throw out any that are not relevant for whatever reason
    return c.length;
  });

  if (!this.set.length) {
    throw new TypeError('Invalid SemVer Range: ' + range);
  }

  this.format();
}

Range.prototype.inspect = function() {
  return '<SemVer Range "' + this.range + '">';
};

Range.prototype.format = function() {
  this.range = this.set.map(function(comps) {
    return comps.join(' ').trim();
  }).join('||').trim();
  return this.range;
};

Range.prototype.toString = function() {
  return this.range;
};

Range.prototype.parseRange = function(range) {
  var loose = this.loose;
  range = range.trim();
  debug('range', range, loose);
  // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
  var hr = loose ? re[HYPHENRANGELOOSE] : re[HYPHENRANGE];
  range = range.replace(hr, hyphenReplace);
  debug('hyphen replace', range);
  // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
  range = range.replace(re[COMPARATORTRIM], comparatorTrimReplace);
  debug('comparator trim', range, re[COMPARATORTRIM]);

  // `~ 1.2.3` => `~1.2.3`
  range = range.replace(re[TILDETRIM], tildeTrimReplace);

  // `^ 1.2.3` => `^1.2.3`
  range = range.replace(re[CARETTRIM], caretTrimReplace);

  // normalize spaces
  range = range.split(/\s+/).join(' ');

  // At this point, the range is completely trimmed and
  // ready to be split into comparators.

  var compRe = loose ? re[COMPARATORLOOSE] : re[COMPARATOR];
  var set = range.split(' ').map(function(comp) {
    return parseComparator(comp, loose);
  }).join(' ').split(/\s+/);
  if (this.loose) {
    // in loose mode, throw out any that are not valid comparators
    set = set.filter(function(comp) {
      return !!comp.match(compRe);
    });
  }
  set = set.map(function(comp) {
    return new Comparator(comp, loose);
  });

  return set;
};

// Mostly just for testing and legacy API reasons
exports.toComparators = toComparators;
function toComparators(range, loose) {
  return new Range(range, loose).set.map(function(comp) {
    return comp.map(function(c) {
      return c.value;
    }).join(' ').trim().split(' ');
  });
}

// comprised of xranges, tildes, stars, and gtlt's at this point.
// already replaced the hyphen ranges
// turn into a set of JUST comparators.
function parseComparator(comp, loose) {
  debug('comp', comp);
  comp = replaceCarets(comp, loose);
  debug('caret', comp);
  comp = replaceTildes(comp, loose);
  debug('tildes', comp);
  comp = replaceXRanges(comp, loose);
  debug('xrange', comp);
  comp = replaceStars(comp, loose);
  debug('stars', comp);
  return comp;
}

function isX(id) {
  return !id || id.toLowerCase() === 'x' || id === '*';
}

// ~, ~> --> * (any, kinda silly)
// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0
// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0
// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0
// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0
// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0
function replaceTildes(comp, loose) {
  return comp.trim().split(/\s+/).map(function(comp) {
    return replaceTilde(comp, loose);
  }).join(' ');
}

function replaceTilde(comp, loose) {
  var r = loose ? re[TILDELOOSE] : re[TILDE];
  return comp.replace(r, function(_, M, m, p, pr) {
    debug('tilde', comp, _, M, m, p, pr);
    var ret;

    if (isX(M))
      ret = '';
    else if (isX(m))
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    else if (isX(p))
      // ~1.2 == >=1.2.0- <1.3.0-
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
    else if (pr) {
      debug('replaceTilde pr', pr);
      if (pr.charAt(0) !== '-')
        pr = '-' + pr;
      ret = '>=' + M + '.' + m + '.' + p + pr +
            ' <' + M + '.' + (+m + 1) + '.0';
    } else
      // ~1.2.3 == >=1.2.3 <1.3.0
      ret = '>=' + M + '.' + m + '.' + p +
            ' <' + M + '.' + (+m + 1) + '.0';

    debug('tilde return', ret);
    return ret;
  });
}

// ^ --> * (any, kinda silly)
// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0
// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0
// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0
// ^1.2.3 --> >=1.2.3 <2.0.0
// ^1.2.0 --> >=1.2.0 <2.0.0
function replaceCarets(comp, loose) {
  return comp.trim().split(/\s+/).map(function(comp) {
    return replaceCaret(comp, loose);
  }).join(' ');
}

function replaceCaret(comp, loose) {
  debug('caret', comp, loose);
  var r = loose ? re[CARETLOOSE] : re[CARET];
  return comp.replace(r, function(_, M, m, p, pr) {
    debug('caret', comp, _, M, m, p, pr);
    var ret;

    if (isX(M))
      ret = '';
    else if (isX(m))
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    else if (isX(p)) {
      if (M === '0')
        ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
      else
        ret = '>=' + M + '.' + m + '.0 <' + (+M + 1) + '.0.0';
    } else if (pr) {
      debug('replaceCaret pr', pr);
      if (pr.charAt(0) !== '-')
        pr = '-' + pr;
      if (M === '0') {
        if (m === '0')
          ret = '>=' + M + '.' + m + '.' + p + pr +
                ' <' + M + '.' + m + '.' + (+p + 1);
        else
          ret = '>=' + M + '.' + m + '.' + p + pr +
                ' <' + M + '.' + (+m + 1) + '.0';
      } else
        ret = '>=' + M + '.' + m + '.' + p + pr +
              ' <' + (+M + 1) + '.0.0';
    } else {
      debug('no pr');
      if (M === '0') {
        if (m === '0')
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + m + '.' + (+p + 1);
        else
          ret = '>=' + M + '.' + m + '.' + p +
                ' <' + M + '.' + (+m + 1) + '.0';
      } else
        ret = '>=' + M + '.' + m + '.' + p +
              ' <' + (+M + 1) + '.0.0';
    }

    debug('caret return', ret);
    return ret;
  });
}

function replaceXRanges(comp, loose) {
  debug('replaceXRanges', comp, loose);
  return comp.split(/\s+/).map(function(comp) {
    return replaceXRange(comp, loose);
  }).join(' ');
}

function replaceXRange(comp, loose) {
  comp = comp.trim();
  var r = loose ? re[XRANGELOOSE] : re[XRANGE];
  return comp.replace(r, function(ret, gtlt, M, m, p, pr) {
    debug('xRange', comp, ret, gtlt, M, m, p, pr);
    var xM = isX(M);
    var xm = xM || isX(m);
    var xp = xm || isX(p);
    var anyX = xp;

    if (gtlt === '=' && anyX)
      gtlt = '';

    if (xM) {
      if (gtlt === '>' || gtlt === '<') {
        // nothing is allowed
        ret = '<0.0.0';
      } else {
        // nothing is forbidden
        ret = '*';
      }
    } else if (gtlt && anyX) {
      // replace X with 0
      if (xm)
        m = 0;
      if (xp)
        p = 0;

      if (gtlt === '>') {
        // >1 => >=2.0.0
        // >1.2 => >=1.3.0
        // >1.2.3 => >= 1.2.4
        gtlt = '>=';
        if (xm) {
          M = +M + 1;
          m = 0;
          p = 0;
        } else if (xp) {
          m = +m + 1;
          p = 0;
        }
      } else if (gtlt === '<=') {
        // <=0.7.x is actually <0.8.0, since any 0.7.x should
        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
        gtlt = '<'
        if (xm)
          M = +M + 1
        else
          m = +m + 1
      }

      ret = gtlt + M + '.' + m + '.' + p;
    } else if (xm) {
      ret = '>=' + M + '.0.0 <' + (+M + 1) + '.0.0';
    } else if (xp) {
      ret = '>=' + M + '.' + m + '.0 <' + M + '.' + (+m + 1) + '.0';
    }

    debug('xRange return', ret);

    return ret;
  });
}

// Because * is AND-ed with everything else in the comparator,
// and '' means "any version", just remove the *s entirely.
function replaceStars(comp, loose) {
  debug('replaceStars', comp, loose);
  // Looseness is ignored here.  star is always as loose as it gets!
  return comp.trim().replace(re[STAR], '');
}

// This function is passed to string.replace(re[HYPHENRANGE])
// M, m, patch, prerelease, build
// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
// 1.2.3 - 3.4 => >=1.2.0 <3.5.0 Any 3.4.x will do
// 1.2 - 3.4 => >=1.2.0 <3.5.0
function hyphenReplace($0,
                       from, fM, fm, fp, fpr, fb,
                       to, tM, tm, tp, tpr, tb) {

  if (isX(fM))
    from = '';
  else if (isX(fm))
    from = '>=' + fM + '.0.0';
  else if (isX(fp))
    from = '>=' + fM + '.' + fm + '.0';
  else
    from = '>=' + from;

  if (isX(tM))
    to = '';
  else if (isX(tm))
    to = '<' + (+tM + 1) + '.0.0';
  else if (isX(tp))
    to = '<' + tM + '.' + (+tm + 1) + '.0';
  else if (tpr)
    to = '<=' + tM + '.' + tm + '.' + tp + '-' + tpr;
  else
    to = '<=' + to;

  return (from + ' ' + to).trim();
}


// if ANY of the sets match ALL of its comparators, then pass
Range.prototype.test = function(version) {
  if (!version)
    return false;

  if (typeof version === 'string')
    version = new SemVer(version, this.loose);

  for (var i = 0; i < this.set.length; i++) {
    if (testSet(this.set[i], version))
      return true;
  }
  return false;
};

function testSet(set, version) {
  for (var i = 0; i < set.length; i++) {
    if (!set[i].test(version))
      return false;
  }

  if (version.prerelease.length) {
    // Find the set of versions that are allowed to have prereleases
    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
    // That should allow `1.2.3-pr.2` to pass.
    // However, `1.2.4-alpha.notready` should NOT be allowed,
    // even though it's within the range set by the comparators.
    for (var i = 0; i < set.length; i++) {
      debug(set[i].semver);
      if (set[i].semver === ANY)
        continue;

      if (set[i].semver.prerelease.length > 0) {
        var allowed = set[i].semver;
        if (allowed.major === version.major &&
            allowed.minor === version.minor &&
            allowed.patch === version.patch)
          return true;
      }
    }

    // Version has a -pre, but it's not one of the ones we like.
    return false;
  }

  return true;
}

exports.satisfies = satisfies;
function satisfies(version, range, loose) {
  try {
    range = new Range(range, loose);
  } catch (er) {
    return false;
  }
  return range.test(version);
}

exports.maxSatisfying = maxSatisfying;
function maxSatisfying(versions, range, loose) {
  return versions.filter(function(version) {
    return satisfies(version, range, loose);
  }).sort(function(a, b) {
    return rcompare(a, b, loose);
  })[0] || null;
}

exports.validRange = validRange;
function validRange(range, loose) {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range(range, loose).range || '*';
  } catch (er) {
    return null;
  }
}

// Determine if version is less than all the versions possible in the range
exports.ltr = ltr;
function ltr(version, range, loose) {
  return outside(version, range, '<', loose);
}

// Determine if version is greater than all the versions possible in the range.
exports.gtr = gtr;
function gtr(version, range, loose) {
  return outside(version, range, '>', loose);
}

exports.outside = outside;
function outside(version, range, hilo, loose) {
  version = new SemVer(version, loose);
  range = new Range(range, loose);

  var gtfn, ltefn, ltfn, comp, ecomp;
  switch (hilo) {
    case '>':
      gtfn = gt;
      ltefn = lte;
      ltfn = lt;
      comp = '>';
      ecomp = '>=';
      break;
    case '<':
      gtfn = lt;
      ltefn = gte;
      ltfn = gt;
      comp = '<';
      ecomp = '<=';
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }

  // If it satisifes the range it is not outside
  if (satisfies(version, range, loose)) {
    return false;
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (var i = 0; i < range.set.length; ++i) {
    var comparators = range.set[i];

    var high = null;
    var low = null;

    comparators.forEach(function(comparator) {
      if (comparator.semver === ANY) {
        comparator = new Comparator('>=0.0.0')
      }
      high = high || comparator;
      low = low || comparator;
      if (gtfn(comparator.semver, high.semver, loose)) {
        high = comparator;
      } else if (ltfn(comparator.semver, low.semver, loose)) {
        low = comparator;
      }
    });

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false;
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) &&
        ltefn(version, low.semver)) {
      return false;
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false;
    }
  }
  return true;
}

}).call(this,require('_process'))
},{"_process":30}],43:[function(require,module,exports){
(function (global){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	// Normally, the page is loaded from http or https, so not specifying a protocol
	// will result in a (valid) protocol-relative url. However, this won't work if
	// the protocol is something else, like 'file:'
	var defaultProtocol = global.location.protocol.search(/^https?:$/) === -1 ? 'http:' : ''

	var protocol = opts.protocol || defaultProtocol
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/request":45,"builtin-status-codes":13,"url":49,"xtend":56}],44:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

var xhr = new global.XMLHttpRequest()
// If XDomainRequest is available (ie only, where xhr might not work
// cross domain), use the page location. Otherwise use example.com
xhr.open('GET', global.XDomainRequest ? '/' : 'https://example.com')

function checkTypeSupport (type) {
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

exports.arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer')
// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')
exports.overrideMimeType = isFunction(xhr.overrideMimeType)
exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
  return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],45:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var response = require('./response')
var stream = require('readable-stream')
var toArrayBuffer = require('to-arraybuffer')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary, useFetch) {
	if (capability.fetch && useFetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	Object.keys(opts.headers).forEach(function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	var useFetch = true
	if (opts.mode === 'disable-fetch') {
		// If the use of XHR should be preferred and includes preserving the 'content-type' header
		useFetch = false
		preferBinary = true
	} else if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary, useFetch)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (unsafeHeaders.indexOf(lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var self = this
	return self._headers[name.toLowerCase()].value
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body
	if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH' || opts.method === 'MERGE') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return toArrayBuffer(buffer)
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	if (self._mode === 'fetch') {
		var headers = Object.keys(headersObj).map(function (name) {
			return [headersObj[name].name, headersObj[name].value]
		})

		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headers,
			body: body,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		Object.keys(headersObj).forEach(function (name) {
			xhr.setRequestHeader(headersObj[name].name, headersObj[name].value)
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable and non-zero, indicating no error.
 * Even though the spec says it should be available in readyState 3,
 * accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		var status = xhr.status
		return (status !== null && status !== 0)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":44,"./response":46,"_process":30,"buffer":12,"inherits":22,"readable-stream":41,"to-arraybuffer":48}],46:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var stream = require('readable-stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.url = response.url
		self.statusCode = response.status
		self.statusMessage = response.statusText
		
		response.headers.forEach(function(header, key){
			self.headers[key.toLowerCase()] = header
			self.rawHeaders.push(key, header)
		})


		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.url = xhr.responseURL
		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		headers.forEach(function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (key === 'set-cookie') {
					if (self.headers[key] === undefined) {
						self.headers[key] = []
					}
					self.headers[key].push(matches[2])
				} else if (self.headers[key] !== undefined) {
					self.headers[key] += ', ' + matches[2]
				} else {
					self.headers[key] = matches[2]
				}
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE || !xhr.response)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":44,"_process":30,"buffer":12,"inherits":22,"readable-stream":41}],47:[function(require,module,exports){
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

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":12}],48:[function(require,module,exports){
var Buffer = require('buffer').Buffer

module.exports = function (buf) {
	// If the buffer is backed by a Uint8Array, a faster version will work
	if (buf instanceof Uint8Array) {
		// If the buffer isn't a subarray, return the underlying ArrayBuffer
		if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
			return buf.buffer
		} else if (typeof buf.buffer.slice === 'function') {
			// Otherwise we need to get a proper copy
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		}
	}

	if (Buffer.isBuffer(buf)) {
		// This is the slow version that will work with any Buffer
		// implementation (even in old browsers)
		var arrayCopy = new Uint8Array(buf.length)
		var len = buf.length
		for (var i = 0; i < len; i++) {
			arrayCopy[i] = buf[i]
		}
		return arrayCopy.buffer
	} else {
		throw new Error('Argument must be a Buffer')
	}
}

},{"buffer":12}],49:[function(require,module,exports){
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

},{"./util":50,"punycode":31,"querystring":34}],50:[function(require,module,exports){
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

},{}],51:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],52:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"dup":22}],53:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],54:[function(require,module,exports){
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
},{"./support/isBuffer":53,"_process":30,"inherits":52}],55:[function(require,module,exports){
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

},{}],56:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[2]);
