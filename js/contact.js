/* global ga */
function validate(form) {
  try {
    var valid = validateFields(form);
    if (valid) {
      var xhr = new XMLHttpRequest();
      xhr.open(form.method, form.action, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.send(new FormData(form));
      xhr.onerror = postError;
      xhr.onloadend = function () {
        if ("undefined" != typeof JSON) {
          var resp = JSON.parse(xhr.response);
          if (resp.sent) postSuccess(form);
          else postError();
        } else {
          if (~xhr.response.indexOf("{\"sent\":true")) postSuccess(form);
          else postError();
        }
      };
    }
  } catch (ex) { postError(); }
  return false;
}

function postError() {
  alert("Sorry there was a problem submitting the form.\nPlease try again.");
}

function postSuccess(form) {
  if (ga)
    ga('send', {
      hitType: 'event',
      eventCategory: 'contact-form', /* Don't change these without changing the goal in analytics! */
      eventAction: 'submit',
      eventLabel: form.email.value,
      transport: 'beacon'
    });
  var reason = getReasonField();
  if (reason && reason.value) window.location.hash="reason=" + reason.value;
  // Include contact in replacement as google tries to index /thankyou
  window.location.pathname = window.location.pathname.replace(/\/contact\/?$/, '/contact/thankyou/');
}

function removeClass(el, className) {
  if (el && className) {
    var classes = el.className.split(" "),
    newClasses = [];
    for (var i = 0 , l = classes.length; i < l; i++)
      if (className != classes[i].toLowerCase()) newClasses.push(classes[i]);
    el.className = newClasses.join(" ");
  }
}

function getReasonField() {
  var elements = document.forms.contact.elements,
    reason,
    count = 0;
  while ((reason === undefined) && (count < elements.length)) {
    if ("reason" == elements[count].name.toLowerCase()) reason = elements[count];
    count++;
  }
  return reason;
}

function validateFields(form) {
  var valid = false,
    invalidClass = "invalid",
    focusField;
  try {
    if (form && form.name) {
      var elements = document.forms[form.name].elements;
      if (elements && (0 < elements.length)) {
        valid = true;
        for (var i = 0, l = elements.length; i < l; i++) {
          var el = elements[i],
            elValid = true;
          removeClass(el, invalidClass);
          if ((el.type.toLowerCase() == "text") || (el.type.toLowerCase() == "tel") || (el.tagName.toLowerCase() == "textarea")) {
            if (/^\s*$/.test(el.value)) elValid = false;
          } else if (el.tagName.toLowerCase() == "select") {
            if (el.selectedIndex < 1) elValid = false;
          } else {
            switch (el.type) {
              case "email":
                /* Removed validation of email */
                /* if (!/^[a-z0-9\-\.]+@[a-z0-9\-]{3,}(\.[a-z0-9\-]{2,})+/.test(el.value.toLowerCase())) elValid = false; */
                break;
              case "submit":
                break;
              case "reset":
                break;
              default:
                /* Unknown Element */
                elValid = false;
                break;
            }
          }
          if (!elValid && (el.getAttribute('required').toLowerCase() == 'required')) {
            el.className += (el.className !== "" ? " " : "") + invalidClass;
            focusField = focusField || el;
          }
          valid = valid && elValid;
        }
      }
    }
  } catch (ex) { /* Do nothing */}
  try {
    if (focusField) focusField.focus();
  } catch (ex) { /* Do nothing */}
  return valid;
}

try {
  var email = document.getElementById('email');
  if (email) {
    email.focus();
  }
} catch (ex) { /* Do nothing */ }

if (0 < window.location.hash.length) {
  var reason = getReasonField();
  if (reason) {
    var matches = window.location.hash.match(/#(?:.+&)?reason=([\w-]+)?/),
      reasonValue;
    if (matches && 2 <= matches.length) reasonValue = matches[1].toLowerCase();
    if (reasonValue) {

      for (var j = 0, m = reason.children.length; j < m; j++) {
        var option = reason.children[j];
        option.removeAttribute("selected");
        if (option.value && (reasonValue == option.value.toLowerCase())) option.setAttribute("selected", "selected");
      }
    }
  }
  window.location.hash = "";
}
