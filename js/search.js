var ajax = (function() {
  var _ajax = {
    createXMLHTTPObject: function() {
      var xmlhttp = false,
        factories = [
          function () { return new XMLHttpRequest(); },
          function () { return new ActiveXObject('Msxml2.XMLHTTP'); },
          function () { return new ActiveXObject('Msxml3.XMLHTTP'); },
          function () { return new ActiveXObject('Microsoft.XMLHTTP'); }
      ];

      for (var i=0, l=factories.length; i<l; i++) {
        try {
          xmlhttp = factories[i]();
        } catch (e) { continue; }
        break;
      }
      return xmlhttp;
    },
    fetch: function(location, callback) {
      var req = _ajax.createXMLHTTPObject();
      if (!req) {
        callback(new Error('Failed to create XMLHttpResquest'));
        return;
      }

      req.open('GET', location, true);
      req.onreadystatechange = function () {
        if (req.readyState !== 4) return;
        if (req.status !== 200 && req.status !== 304) {
          callback(new Error(req.status + ' - ' + req.statusText));
          return;
        }
        callback(null, req);
      };
      if (req.readyState === 4) return;
      req.send(null);
    }
  };

  return {
    fetch: _ajax.fetch
  };

})();

var lunr_plugin_excerpt = function (idx, raw, options) {
  options = options || {};
  if (options.continuationIndicator === undefined) options.continuationIndicator = '<span class=\'hellip\'>&hellip;</span>';
  if (options.contextWords === undefined) options.contextWords = 10;
  if (options.separatorWords === undefined) options.separatorWords = options.contextWords;
  if (options.introWords === undefined) options.introWords = options.contextWords * 2;
  if (options.excerptClass === undefined) options.excerptClass = 'excerpt';
  if (options.bodyPropertyName === undefined) options.bodyPropertyName = 'body';

  var _excerpt = {
    init: function() {
      this._search = idx.search;
      idx.search = this.search;
    },
    escapeRegExp: function(str) {
      return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    },
    getSearchTerms: function(query) {
      var stems = idx.pipeline.run(idx.tokenizerFn(query)),
      terms = query.split(/\s+/);
      stems.forEach(function(stem) {
        if (!~terms.indexOf(stem)) terms.push(stem);
      });
      return terms;
    },
    generateExcerpts: function(query, results) {
      var terms = _excerpt.getSearchTerms(query),
          termExp = terms
            .sort(function(a, b) { return b.length - a.length; }) // place longest terms first
            .map(_excerpt.escapeRegExp)
            .join('|');
      results.forEach(function(result) {
        var rawResult = raw[result.ref],
            text = rawResult[options.bodyPropertyName],
            excerptRe = new RegExp(
            '(?:' +                           // Leading Context
              '(^\\W*(?:\\w+\\W+){0,'+options.contextWords+'}?)' + // Allow lazy match of shorter context from start of text,
              '|((?:\\w+\\W+){'+options.contextWords+'})' +         // Or match with full context within text
            ')' +
            '(' +
              '(?:' +                         // Repeat match group - this group finds all matches with another match within 10 words
                '(?:' + termExp + ')' +       // matched word
                '\\w*?' +                     // word suffix (lazy to ensure longest match wins)
                '(?:' +
                  '\\W+' +
                  '(?:\\w+\\W+){0,'+options.separatorWords+'}?' +
                ')' +                         // lazy match up to 10 words between matches
              ')*' +                          // 0 or more times
              '(?:' +                         // Main match group. This must always match to be successful
                '(?:' + termExp + ')' +       // matched word
                '(?:\\w*)' +                  // optional word suffix to match word prefixes
              ')' +
            ')' +
            '(?:' +                           // Trailing Context
              '((?:\\W+\\w+){0,'+options.contextWords+'}?)\\W*$' +  // Allow lazy match shorter context at end of text
              '|((?:\\W+\\w+){'+options.contextWords+'})' +         // or match with full context within text
            ')',
            'gi');

        var excerpts = [],
          excerptsHTML = '',
          first = true,
          match;

        excerpts.firstStartsAtTextStart = excerpts.lastEndsAtTextEnd = false;

        while ((match = excerptRe.exec(text)) !== null) {
          var atStart = match[1] !== undefined,
              leadingContext = atStart ? match[1] : match[2],
              excerptMatch = match[3],
              atEnd = match[4] !== undefined,
              trailingContext = atEnd ? match[4] : match[5],
              excerptText = leadingContext + excerptMatch + trailingContext;

          if (first) {
            if (atStart) excerpts.firstStartsAtTextStart = atStart;
            else excerptsHTML += options.continuationIndicator;
            first = false;
          }

          // TODO: HTML-encode this!
          excerptsHTML += excerptText;
          excerpts.push(excerptText);

          if (atEnd) excerpts.lastEndsAtTextEnd = atEnd;
          else excerptsHTML += options.continuationIndicator;
        }

        if (first) {
          // Didn't find a match in text.
          var titleRe = new RegExp(termExp, "mi");
          if (rawResult.title !== null && titleRe.exec(rawResult.title)) {
            // Didn't find a match in text but title matches.
            // Grab first 10 words as excerpt
            var introRe = new RegExp(
                "^\\W*" +
                "(?:" +
                  "(?:((?:\w+\W+){0," + (options.introWords-1) + "}?\w+|)\W*$)" +
                  "|((?:\\w+\\W+){" + options.introWords + "})" +
                ")"),
                matches = introRe.exec(text),
                /*jshint -W041*/// We really do want != null here to also check undefined!)
                matchedEnd = (matches[1] != null && !!(matches[1].length)),
                /*jshint +W041*/
                pageText = matchedEnd ? matches[1] : matches[2]
                ;

            excerpts.firstStartsAtTextStart = true;
            excerptsHTML = pageText;
            excerpts.push(pageText);

            if (!matchedEnd) pageText += options.continuationIndicator;
            else excerpts.lastEndsAtTextEnd = true;
          } else {
            // TODO: what do we do here? No excerpt found & doesn't match page title?
          }
        }

        result.excerpts = excerpts;
        result.excerptsHTML = excerptsHTML;
      });

      return results;
    },
    search: function(query) {
      var results = _excerpt._search.call(idx, query);
      return _excerpt.generateExcerpts(query, results);
    }
  };

  _excerpt.init();
};

var lunr_plugin_highlight = function (idx, raw, options) {
  options = options || {};

  if (options.continuationIndicator === undefined) options.continuationIndicator = '<span class=\'hellip\'>&hellip;</span>';
  if (options.matchClass === undefined) options.matchClass = 'match';
  if (options.bodyObjectName === undefined) options.bodyObjectName = 'raw';
  if (options.bodyPropertyName === undefined) options.bodyPropertyName = 'body';

  var _highlight = {
    init: function() {
      this._search = idx.search;
      idx.search = this.search;
    },
    escapeRegExp: function(str) {
      return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    },
    getSearchTerms: function(query) {
      var stems = idx.pipeline.run(idx.tokenizerFn(query)),
      terms = query.split(/\s+/);
      stems.forEach(function(stem) {
        if (!~terms.indexOf(stem)) terms.push(stem);
      });
      return terms;
    },
    highlightMatches: function(query, results) {
      var terms = _highlight.getSearchTerms(query),
          termExp = terms
            .sort(function(a, b) { return b.length - a.length; }) // try to match longest terms first so searching "u uni" in univerity matches uni not u
            .map(_highlight.escapeRegExp)
            .join('|');

      results.forEach(function(result) {
        var rawResult = raw[result.ref],
            bodyObject = options.bodyObjectName === 'result' ? result : rawResult,
            property = options.bodyPropertyName,
            body
            ;
        if ((body = bodyObject[property]) !== null) {
          var highlights = [],
              highlightHTML = '',
              termRe = new RegExp('\\b(' + termExp + ')', 'gi'),
              highlightReplacement = '<span class="' + options.matchClass + '">$1</span>',
              isExcerpts = Array.isArray(body) && body.hasOwnProperty('firstStartsAtTextStart') && body.hasOwnProperty('lastEndsAtTextEnd');

          if (Array.isArray(body)) {
            // Handle arrays returned from "excerpt" plugin
            highlights.firstStartsAtTextStart = body.firstStartsAtTextStart;
            highlights.lastEndsAtTextEnd = body.lastEndsAtTextEnd;

            if (isExcerpts && !body.firstStartsAtTextStart && body.length > 0)
              highlightHTML += options.continuationIndicator + ' ';

            body.forEach(function(bodyItem, i) {
              var highlighted = bodyItem.replace(termRe, highlightReplacement);

              if (i > 0) highlightHTML += ' ';

              highlights.push(highlighted);
              highlightHTML += highlighted;
            });

            if (isExcerpts && !body.lastEndsAtTextEnd && body.length > 0)
              highlightHTML += ' ' + options.continuationIndicator;

            result.highlights = highlights;
          } else {
            highlightHTML = body.replace(termRe, highlightReplacement);
          }

          result.highlightHTML = highlightHTML;
        }
      });
      return results;
    },
    search: function(query) {
      var results = _highlight._search.call(idx, query);
      return _highlight.highlightMatches(query, results);
    }
  };

  _highlight.init();
};

var queryString = {
  params: function(url) {
    var _queryString = url ? url.split('?')[1] : window.location.search.slice(1),
      params = {};

    if (_queryString) {
      // remove hash as it isn't part of query string
      _queryString = _queryString.split('#')[0];

      // split query string into its component parts
      var components = _queryString.split('&'),
        getListIndex = function(string) {
          var matches = (''+string).match(/\[(\d+)\]/);
          if (matches && 2 === matches.length) return matches[1];
          return undefined;
        },
        decodeString = function(string) {
          return decodeURIComponent(string.replace(/\+/g, ' '));
        };

      for (var i=0, l=components.length; i<l; i++) {
        // separate the keys and the values
        var a = components[i].split('='),
        // in case params look like: list[]=thing1&list[]=thing2
          paramNum = getListIndex(a[0]),
          paramName = a[0].replace(/\[\d*\]/, ''),
        // set parameter value (use 'true' if empty)
          paramValue = typeof (a[1]) === 'undefined' ? true : a[1];

        // (optional) keep case consistent
        paramName = decodeString(paramName.toLowerCase());
        paramValue = decodeString(paramValue);

        // if parameter name already exists
        if (params[paramName]) {
          // convert value to array (if still string)
          if (typeof params[paramName] === 'string') params[paramName] = [params[paramName]];

          // if no array index number specified...
          if (typeof paramNum === 'undefined')
            // put the value on the end of the array
            params[paramName].push(paramValue);
          // if array index number specified...
          else
            // put the value at that index number
            params[paramName][paramNum] = paramValue;
        }
        // if param name doesn't exist yet, set it
        else params[paramName] = paramValue;
      }
    }
    return params;
  }
};

var search = {
  config: void 0,
  json: void 0,
  index: void 0,
  raw: void 0,
  init: function(config) {
    this.config = (config || {});
    this.config.searchFileName = this.config.searchFileName || 'search.json';
    if (lunr && ajax) {
      var el = document.getElementById('searchQuery');
      if (el) el.onkeyup = search.find;

      ajax.fetch(this.config.searchFileName, function(err, req) {
        if (err) search.error(err);
        else search.loadIndex(req.responseText);
      });
    } else this.error('Lunr not loaded');
  },
  addMessage: function(el, message, className) {
    el = el || document.getElementById('searchResults');
    className = className || 'noResults';
    var text = document.createElement('p');
    text.appendChild(document.createTextNode(message || 'No results found'));
    text.className = className;
    el.appendChild(text);
  },
  error: function(message) {
    search.addMessage(null, message, 'searchError');
    console.error(message);
  },
  addPlugins: function() {
    this.lunrIdx.use(lunr_plugin_excerpt, this.raw);
    this.lunrIdx.use(lunr_plugin_highlight, this.raw, { bodyObjectName: 'result', bodyPropertyName: 'excerpts' });
  },
  checkForQueryString: function() {
    var query = queryString.params().q;
    // take last value if array of values
    if ('object' === typeof query) query = query.pop();
    if (query) {
      var el = document.getElementById('searchQuery');
      if (el) el.value = query;
      this.find.call(el);
    }
  },
  loadIndex: function(json) {
    if (json) {
      try { json = JSON.parse(json); }
      catch (ex) {
        search.error(ex);
        return;
      }

      this.lunrIdx = lunr.Index.load(json.idx);
      this.raw = json.raw;
      this.addPlugins();
      this.checkForQueryString();
    } else this.error('No search data to load');
  },
  sendAnalytics: function() {
    var send = function(phrase) {
      if (phrase)
        ga('send', {
          hitType: 'event',
          eventCategory: 'search',
          eventAction: 'query',
          eventLabel: phrase,
          transport: 'beacon',
          nonInteraction: true
        });
    };

    /* TODO: Make this use onload event instead of hack to make sure debounce has loaded */
    if (!this._debouncedAnalytics)
      this._debouncedAnalytics = debounce(send, 1000);
    // Debounce might not be loaded yet, just return send
    return 'function' === typeof this._debouncedAnalytics ? this._debouncedAnalytics : send;
  },
  find: function() {
    var query = ('' + this.value).trim();
    search.renderResults(search.lunrIdx.search(query), query);
    search.sendAnalytics()(query);
  },
  clearResults: function() {
    var el = document.getElementById('searchResults');
    if (el)
      while (el.children.length)
        el.removeChild(el.lastChild);
  },
  formatDate: function(date) {
    date = (date) ? new Date(date) : new Date();
    return ('0' + date.getDate()).slice(-2) + '/' +
           ('0' + (date.getMonth() + 1)).slice(-2) + '/' +
           date.getFullYear();
  },
  constructSingleResult: function(result, phrase) {
    var rawResult = this.raw[result.ref];
    var single = document.createElement('div');
    single.className = 'result shadow';

    var link = document.createElement('a');
    link.appendChild(document.createTextNode(rawResult.title));
    link.href = rawResult.url;

    var heading = document.createElement('h3');
    heading.appendChild(link);

    var meta = document.createElement('div');
    meta.className = 'meta';

    if (rawResult.published) {
      var published = document.createElement('p');
      published.appendChild(document.createTextNode(this.formatDate(rawResult.published)));
      published.className = 'published';
      meta.appendChild(published);
    }

    if (rawResult.modified && rawResult.modified != rawResult.published) {
      var modified = document.createElement('p');
      modified.appendChild(document.createTextNode(this.formatDate(rawResult.modified)));
      modified.className = 'modified';
      meta.appendChild(modified);
    }

    var tags;
    if (rawResult.tags) {
      tags = document.createElement('p');
      tags.appendChild(document.createTextNode(rawResult.tags));
      tags.className = 'tags';
    }

    var excerpt = document.createElement('p');
    excerpt.innerHTML = result.highlightHTML;
    excerpt.className = 'excerpt';

    single.appendChild(heading);
    if (meta.children) single.appendChild(meta);
    if (tags) single.appendChild(tags);
    single.appendChild(excerpt);
    return single;
  },
  renderResults: function(results, phrase) {
    this.clearResults();
    var el = document.getElementById('searchResults');
    if (el) {
      if ((results || []).length)
        for (var i = 0, l=results.length; i < l; i++)
          el.appendChild(search.constructSingleResult(results[i], phrase));
      else if (phrase) this.addMessage(el);
      else this.addMessage(el, 'Please enter a search phrase', 'emptySearch');
    }
  }
};

search.init(searchConfig);
