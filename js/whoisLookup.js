/* global ga */
var whoisLookup = {
  tld: {
    au: 'http://whois.ausregistry.com.au/whois/whois_local.jsp?qry='
  },
  defaultLookup: 'https://whois.icann.org/en/lookup?name=',
  form: document.getElementById('whois-lookup'),
  errors: document.getElementById('whois-errors'),
  init: function() {
    if (this.form) this.form.onsubmit = whoisLookup.submit.bind(whoisLookup);
    try {
      var domain = document.getElementById('domain');
      if (domain) {
        domain.focus();
      }
    } catch (ex) { /* Do nothing */ }
  },
  submit: function() {
    this.errors.innerText = '';
    var parts = this.parse(this.form.domain.value);
    if (parts) {
      var url = this.tld.hasOwnProperty(parts.tld) ? this.tld[parts.tld] : this.defaultLookup;
      url += encodeURIComponent(parts.domain);

      ga('send', {
        hitType: 'event',
        eventCategory: 'whois-lookup',
        eventAction: 'click',
        eventLabel: parts.domain,
        transport: 'beacon',
        nonInteraction: true
      });

      try {
        var win = window.open(url, '_blank');
        win.focus();
      } catch (ex) {
        this.errors.innerHTML = 'There were problems opening a new window.<br />Try this link <a href="' + url + '" target="_blank">' + url + '</a>';
      }
    } else this.errors.innerText = 'The domain name you entered doesn\'t look right. It must be in the format \'example.com.au\'';
    return false;
  },
  parse: function(url) {
    url = ('' + url).trim();
    var matches = url.match(/^(?:(?:[a-z0-9]+-)*[a-z0-9]+\.)+([a-z0-9]{2,})$/);
    if (matches && 2 == matches.length) {
      return {
        domain: matches[0],
        tld: matches[1]
      };
    }
    return;
  }
};
whoisLookup.init();
