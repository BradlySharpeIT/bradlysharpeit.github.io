function debounce(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

var footerSearch = {
  form: document.getElementById('footer-search'),
  init: function() {
    if (this.form) this.form.onsubmit = footerSearch.submit;
  },
  submit: function() {
    ga('send', {
      hitType: 'event',
      eventCategory: 'footer-search',
      eventAction: 'click',
      eventLabel: this.q.value,
      transport: 'beacon',
      nonInteraction: true
    });
    return true;
  }
};
footerSearch.init();
